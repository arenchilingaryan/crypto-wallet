import AsyncStorage from "@react-native-async-storage/async-storage";

import { formatUnits, type Address } from "viem";

import { ACTIVE_NETWORK, isTestnetNetwork } from "@/constants/networks";

import { getActivity } from "@/core/blockchain/getActivity";
import { approvalExposureUsd } from "@/core/blockchain/getApprovals";
import { findKnownSpender } from "@/core/blockchain/knownSpenders";
import { getPortfolio } from "@/core/blockchain/getPortfolio";

import { buildPolicyContext } from "@/core/security/policyContext";
import {
  toAmountUsd,
  type NetworkKind,
} from "@/core/security/policyDecision";
import {
  DEFAULT_SECURITY_POLICY,
  parseSecurityPolicy,
  serializeSecurityPolicy,
  UNAVAILABLE_SECURITY_POLICY,
  type SecurityPolicy,
} from "@/core/security/securityPolicy";
import {
  reviewApproval,
  reviewSwap,
  reviewTransfer,
  type SecurityReview,
} from "@/core/security/securityReview";

import {
  walletIdentityOf,
  type WalletIdentity,
} from "@/core/wallet/walletIdentity";

import { keyValueStorage, walletEngine } from "./compositionRoot";
import { ethereumPublicClient } from "./ethereumPublicClient";
import { trackedTransactionApi } from "./trackedTransactionApi";

const POLICY_KEY = "security.policy.v1";

// The policy itself lives in SecureStore, which answers `null` both for "never
// written" and for "written, but this entry could no longer be decrypted" —
// and only the first of those means the user chose no limits. This marker is a
// non-secret breadcrumb in ordinary device storage: if it says a policy was
// saved and the secure entry reads empty, the limits are unavailable, not
// absent. If device storage is itself wiped, the marker goes with it and we
// are honestly back to a fresh install.
const POLICY_CONFIGURED_MARKER = "security.policy.configured.v1";

async function policyWasConfigured(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(POLICY_CONFIGURED_MARKER)) !== null;
  } catch {
    return false;
  }
}

const networkKind: NetworkKind = isTestnetNetwork(ACTIVE_NETWORK.id)
  ? "testnet"
  : "mainnet";

const contractAddressCache = new Map<string, boolean>();

async function isContractAddress(address: Address): Promise<boolean | null> {
  const key = address.toLowerCase();

  const cached = contractAddressCache.get(key);

  if (cached !== undefined) {
    return cached;
  }

  try {
    const code = await ethereumPublicClient.getCode({ address });

    const isContract = code !== undefined && code !== "0x";

    contractAddressCache.set(key, isContract);

    return isContract;
  } catch (error) {
    console.error("Recipient code lookup failed:", error);

    return null;
  }
}

export const policyApi = {
  async load(): Promise<SecurityPolicy> {
    let raw: string | null;

    try {
      raw = await keyValueStorage.get(POLICY_KEY);
    } catch (error) {
      // A read that failed outright says nothing about what the user chose.
      console.error("Reading the security policy failed:", error);

      return UNAVAILABLE_SECURITY_POLICY;
    }

    if (raw === null) {
      return (await policyWasConfigured())
        ? UNAVAILABLE_SECURITY_POLICY
        : DEFAULT_SECURITY_POLICY;
    }

    // Backfill for anyone whose limits were saved before this marker existed.
    // Without it their first storage fault still reads as "no limits chosen",
    // which is the whole defect. Best effort: a marker we failed to write only
    // means we are no better off than before.
    try {
      await AsyncStorage.setItem(POLICY_CONFIGURED_MARKER, "1");
    } catch {
      // Nothing to do; the next successful read tries again.
    }

    return parseSecurityPolicy(raw);
  },

  async save(policy: SecurityPolicy) {
    await keyValueStorage.set(POLICY_KEY, serializeSecurityPolicy(policy));

    // Written after the policy, so a failed save never leaves the marker
    // claiming limits that were never stored.
    try {
      await AsyncStorage.setItem(POLICY_CONFIGURED_MARKER, "1");
    } catch (error) {
      console.error("Recording that a policy exists failed:", error);
    }
  },

  async check({
    recipient,
    symbol,
    amount,
  }: {
    recipient: Address;

    symbol: string;

    amount: string;
  }): Promise<{
    review: SecurityReview;

    amountUsd: number | null;

    // The wallet this review is about. Callers must hand it back when they
    // prepare the transaction, so a wallet switch in between is refused
    // instead of silently attaching one wallet's review to another's send.
    wallet: WalletIdentity;
  }> {
    const policy = await this.load();

    const wallet = await walletEngine.getActive();

    if (!wallet) {
      throw new Error("Active wallet not found");
    }

    const identity = walletIdentityOf(wallet);

    let activity: Awaited<ReturnType<typeof getActivity>>;

    let tracked: Awaited<
      ReturnType<typeof trackedTransactionApi.listAllForDevice>
    >;

    let portfolio: Awaited<ReturnType<typeof getPortfolio>>;

    const recipientIsContract = await isContractAddress(recipient);

    let context: ReturnType<typeof buildPolicyContext>;

    let priceOf: (ticker: string) => number | null;

    try {
      [activity, tracked, portfolio] = await Promise.all([
        getActivity(wallet.address),

        trackedTransactionApi.listAllForDevice(),

        getPortfolio(wallet.address),
      ]);

      priceOf = (ticker: string) =>
        portfolio.assets.find(
          (asset) => asset.symbol.toLowerCase() === ticker.toLowerCase(),
        )?.priceUsd ?? null;

      // Building the context reads every tracked record. Anything that throws
      // in there is still a context we do not have, and must land in the same
      // blocked branch rather than escaping this call entirely.
      context = buildPolicyContext({
        owner: wallet.address,

        activity,

        tracked,

        priceOf,
      });
    } catch (error) {
      console.error("Policy context failed:", error);

      return {
        review: reviewTransfer({
          recipient,
          symbol,
          amount,
          amountUsd: null,
          recipientIsContract,
          policy,
          context: null,

          // A corrupt local record is not a network problem, and must not be
          // reported as one.
          contextUnavailable:
            error instanceof Error &&
            error.name === "TrackedTransactionStateError"
              ? "local-record"
              : "provider",

          networkKind,
          priceAvailability: "unavailable",
        }),

        amountUsd: null,

        wallet: identity,
      };
    }

    const amountUsd = toAmountUsd(amount, priceOf(symbol));

    return {
      review: reviewTransfer({
        recipient,

        symbol,

        amount,

        amountUsd,

        recipientIsContract,

        policy,

        context,

        networkKind,

        priceAvailability: amountUsd === null ? "unavailable" : "available",
      }),

      amountUsd,

      wallet: identity,
    };
  },

  async checkApproval({
    spender,
    token,
    tokenSymbol,
    amountRaw,
    decimals,
    unlimited,
  }: {
    spender: Address;

    token: Address;

    tokenSymbol: string;

    amountRaw: bigint;

    decimals: number;

    unlimited: boolean;
  }): Promise<{ review: SecurityReview; wallet: WalletIdentity }> {
    const policy = await this.load();

    const wallet = await walletEngine.getActive();

    if (!wallet) {
      throw new Error("Active wallet not found");
    }

    const identity = walletIdentityOf(wallet);

    const knownSpender = findKnownSpender(ACTIVE_NETWORK.id, spender);

    const reviewInput = {
      spender,

      spenderName: knownSpender?.name ?? null,

      spenderKnown: knownSpender !== null,

      token: tokenSymbol,

      allowanceLabel: unlimited
        ? "no limit"
        : `${formatUnits(amountRaw, decimals)} ${tokenSymbol}`,

      unlimited,

      revoking: amountRaw === 0n,

      policy,

      networkKind,
    };

    if (policy.maxApprovalExposureUsd === null) {
      return {
        review: reviewApproval({ ...reviewInput, exposureUsd: null }),

        wallet: identity,
      };
    }

    let exposureUsd: number | null = null;

    try {
      const portfolio = await getPortfolio(wallet.address);

      const asset = portfolio.assets.find(
        (item) => item.contractAddress?.toLowerCase() === token.toLowerCase(),
      );

      exposureUsd = approvalExposureUsd({
        allowanceTokens: Number(formatUnits(amountRaw, decimals)),

        balanceTokens: Number(asset?.balance ?? Number.NaN),

        priceUsd: asset?.priceUsd ?? null,

        unlimited,
      });
    } catch (error) {
      console.error("Approval exposure lookup failed:", error);
    }

    return {
      review: reviewApproval({ ...reviewInput, exposureUsd }),

      wallet: identity,
    };
  },

  async checkSwap({
    amountIn,
    symbolIn,
    minAmountOut,
    symbolOut,
    slippagePercent,
    deadlineMinutes,
    routerKnown,
    routeLabel,
  }: {
    amountIn: string;

    symbolIn: string;

    minAmountOut: string;

    symbolOut: string;

    slippagePercent: string;

    deadlineMinutes: number;

    routerKnown: boolean;

    routeLabel: string;
  }): Promise<{ review: SecurityReview; wallet: WalletIdentity }> {
    const policy = await this.load();

    const wallet = await walletEngine.getActive();

    if (!wallet) {
      throw new Error("Active wallet not found");
    }

    const identity = walletIdentityOf(wallet);

    const reviewInput = {
      symbolIn,
      symbolOut,
      amountIn,
      minAmountOut,
      slippagePercent,
      deadlineMinutes,
      routerKnown,
      routeLabel,
      policy,
      networkKind,
    };

    if (policy.maxSwapLossUsd === null) {
      return {
        review: reviewSwap({ ...reviewInput, lossUsd: null }),

        wallet: identity,
      };
    }

    let lossUsd: number | null = null;

    try {
      const portfolio = await getPortfolio(wallet.address);

      const priceOf = (ticker: string) =>
        portfolio.assets.find(
          (asset) => asset.symbol.toLowerCase() === ticker.toLowerCase(),
        )?.priceUsd ?? null;

      const inUsd = toAmountUsd(amountIn, priceOf(symbolIn));

      const outUsd = toAmountUsd(minAmountOut, priceOf(symbolOut));

      lossUsd = inUsd === null || outUsd === null ? null : inUsd - outUsd;
    } catch (error) {
      console.error("Swap price lookup failed:", error);
    }

    return {
      review: reviewSwap({ ...reviewInput, lossUsd }),

      wallet: identity,
    };
  },
};
