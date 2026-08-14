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
  parseSecurityPolicy,
  serializeSecurityPolicy,
  type SecurityPolicy,
} from "@/core/security/securityPolicy";
import {
  reviewApproval,
  reviewSwap,
  reviewTransfer,
  type SecurityReview,
} from "@/core/security/securityReview";

import { keyValueStorage, walletEngine } from "./compositionRoot";
import { ethereumPublicClient } from "./ethereumPublicClient";
import { trackedTransactionApi } from "./trackedTransactionApi";

const POLICY_KEY = "security.policy.v1";

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
    return parseSecurityPolicy(await keyValueStorage.get(POLICY_KEY));
  },

  async save(policy: SecurityPolicy) {
    await keyValueStorage.set(POLICY_KEY, serializeSecurityPolicy(policy));
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
  }> {
    const policy = await this.load();

    const wallet = await walletEngine.getActive();

    if (!wallet) {
      throw new Error("Active wallet not found");
    }

    let activity: Awaited<ReturnType<typeof getActivity>>;

    let tracked: Awaited<
      ReturnType<typeof trackedTransactionApi.listAllForDevice>
    >;

    let portfolio: Awaited<ReturnType<typeof getPortfolio>>;

    const recipientIsContract = await isContractAddress(recipient);

    try {
      [activity, tracked, portfolio] = await Promise.all([
        getActivity(wallet.address),

        trackedTransactionApi.listAllForDevice(),

        getPortfolio(wallet.address),
      ]);
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
          networkKind,
          priceAvailability: "unavailable",
        }),

        amountUsd: null,
      };
    }

    const priceOf = (ticker: string) =>
      portfolio.assets.find(
        (asset) => asset.symbol.toLowerCase() === ticker.toLowerCase(),
      )?.priceUsd ?? null;

    const context = buildPolicyContext({
      owner: wallet.address,

      activity,

      tracked,

      priceOf,
    });

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
  }): Promise<SecurityReview> {
    const policy = await this.load();

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
      return reviewApproval({ ...reviewInput, exposureUsd: null });
    }

    let exposureUsd: number | null = null;

    try {
      const wallet = await walletEngine.getActive();

      if (wallet) {
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
      }
    } catch (error) {
      console.error("Approval exposure lookup failed:", error);
    }

    return reviewApproval({ ...reviewInput, exposureUsd });
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
  }): Promise<SecurityReview> {
    const policy = await this.load();

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
      return reviewSwap({ ...reviewInput, lossUsd: null });
    }

    let lossUsd: number | null = null;

    try {
      const wallet = await walletEngine.getActive();

      if (wallet) {
        const portfolio = await getPortfolio(wallet.address);

        const priceOf = (ticker: string) =>
          portfolio.assets.find(
            (asset) => asset.symbol.toLowerCase() === ticker.toLowerCase(),
          )?.priceUsd ?? null;

        const inUsd = toAmountUsd(amountIn, priceOf(symbolIn));

        const outUsd = toAmountUsd(minAmountOut, priceOf(symbolOut));

        lossUsd = inUsd === null || outUsd === null ? null : inUsd - outUsd;
      }
    } catch (error) {
      console.error("Swap price lookup failed:", error);
    }

    return reviewSwap({ ...reviewInput, lossUsd });
  },
};
