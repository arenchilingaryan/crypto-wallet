import { formatUnits, type Address, type PublicClient } from "viem";

import { erc20Abi } from "./erc20Abi";
import type { PortfolioAsset } from "./getPortfolio";
import { findKnownSpender, getKnownSpenders } from "./knownSpenders";
import {
  getPermit2Spenders,
  isPermit2Expired,
  PERMIT2_ADDRESS,
  permit2Abi,
  PERMIT2_UNLIMITED,
} from "./permit2";
import { truncateAddress } from "./addressFingerprint";
import { pairKey, type Coverage } from "./approvalDiscovery";

export type ApprovalChannel = "erc20" | "permit2";

export type ApprovalRisk = "low" | "medium" | "high" | "critical";

export type TokenMeta = {
  symbol: string;

  name: string;

  decimals: number;

  logo: string | null;
};

// A candidate the caller found in the wallet's approval history that the known
// list would have missed. `tokenMeta` describes the token when it is not one
// the wallet currently holds (so we have no portfolio row to borrow a symbol
// from); absent metadata falls back to an address-derived placeholder.
export type DiscoveredApproval = {
  token: Address;

  spender: Address;

  tokenMeta?: TokenMeta | null;
};

export type TokenApproval = {
  id: string;

  channel: ApprovalChannel;

  token: Address;

  tokenSymbol: string;

  tokenName: string;

  tokenDecimals: number;

  tokenLogo: string | null;

  spender: Address;

  spenderName: string;

  spenderPurpose: string;

  allowance: bigint;

  unlimited: boolean;

  // False when the current allowance could not be read. The row is shown so the
  // permission is not silently treated as revoked, but without a number.
  allowanceCertain: boolean;

  // False when the token's decimals are a placeholder rather than a fact, which
  // makes any human-readable amount meaningless.
  decimalsCertain: boolean;

  expiresAt: number | null;

  exposureUsd: number | null;

  exposureCertain: boolean;

  risk: ApprovalRisk;
};

export type ApprovalScan = {
  approvals: TokenApproval[];

  totalExposureUsd: number;

  checkedTokens: number;

  checkedSpenders: number;

  expiredCount: number;

  uncertainCount: number;

  // Whether the approval history was read in full. "partial" means at least one
  // block window (or the node itself) could not be read, so undiscovered
  // spenders may exist — the empty-state must not claim safety.
  coverage: Coverage;

  // Distinct active spenders that are not on the known list — the contracts a
  // known-list-only scan would never have surfaced.
  unknownSpenderCount: number;

  // Reads that did not happen, as opposed to reads that returned nothing.
  // `unreadBudgetCount` counts tokens whose Permit2 budget probe failed —
  // anything derived from that budget is unconfirmed, including a row that
  // still manages to show a figure. `unreadPermit2Count` counts failed
  // per-spender Permit2 lookups, where the answer "which contracts can pull
  // this budget" was never obtained at all.
  unreadBudgetCount: number;

  unreadPermit2Count: number;

  // How many Permit2 spenders this network's list even names. Direct approvals
  // are discovered from history, but Permit2 sub-spenders are still only probed
  // from a fixed list — zero here means that channel was never asked at all,
  // which is a limit of the check, not evidence that nothing is there.
  permit2SpendersChecked: number;
};

const UNLIMITED_THRESHOLD = 2n ** 255n;

// A hostile or broken token can flood discovery with unreadable spenders. Cap
// how many "could not verify" rows we surface; the overflow still forces
// partial coverage so the screen never reads as complete.
const MAX_UNCERTAIN_DISCOVERED_ROWS = 25;

function shortenTokenAddress(token: Address): string {
  return truncateAddress(token.toLowerCase());
}

export function approvalExposureUsd({
  allowanceTokens,
  balanceTokens,
  priceUsd,
  unlimited,
}: {
  allowanceTokens: number;
  balanceTokens: number;
  priceUsd: number | null;
  unlimited: boolean;
}): number | null {
  const reachable = unlimited
    ? balanceTokens
    : Math.min(allowanceTokens, balanceTokens);

  return priceUsd !== null && Number.isFinite(reachable)
    ? reachable * priceUsd
    : null;
}

export function scoreApproval({
  unlimited,
  exposureUsd,
  spenderKnown,
  holdsTokens = true,
}: {
  unlimited: boolean;
  exposureUsd: number | null;
  spenderKnown: boolean;
  holdsTokens?: boolean;
}): ApprovalRisk {
  // An unlimited approval to a spender we cannot identify is critical no matter
  // the current balance or price: the standing authorization is the risk itself,
  // and a $0-priced or empty balance today can refill tomorrow while the
  // approval lives on. Escalate before any exposure-based downgrade so a
  // drainer's unlimited approval is never scored merely "medium".
  if (!spenderKnown && unlimited) {
    return "critical";
  }

  if (exposureUsd === null) {
    if (!holdsTokens) {
      return unlimited ? "medium" : "low";
    }

    if (!spenderKnown) {
      return "critical";
    }

    return unlimited ? "high" : "medium";
  }

  if (!spenderKnown && exposureUsd > 0) {
    return "critical";
  }

  if (unlimited) {
    return exposureUsd >= 1000 ? "critical" : exposureUsd > 0 ? "high" : "medium";
  }

  if (exposureUsd >= 1000) {
    return "high";
  }

  return exposureUsd > 0 ? "medium" : "low";
}

function countDistinctSpenders(
  direct: { address: Address }[],
  permit2: Address[],
) {
  const unique = new Set<string>();

  for (const spender of direct) {
    unique.add(spender.address.toLowerCase());
  }

  for (const spender of permit2) {
    unique.add(spender.toLowerCase());
  }

  return unique.size;
}

type DirectPair = {
  token: Address;

  spender: Address;

  // The portfolio row for this token when the wallet holds it — the source of
  // balance, price and display metadata. Null for discovered tokens the wallet
  // no longer holds.
  asset: PortfolioAsset | null;

  meta: TokenMeta | null;

  // True for a candidate that came from history rather than the known list, so
  // an unreadable allowance is surfaced as uncertain rather than dropped.
  discovered: boolean;
};

function assetMeta(asset: PortfolioAsset): TokenMeta {
  return {
    symbol: asset.symbol,

    name: asset.name,

    decimals: asset.decimals,

    logo: asset.logo,
  };
}

function resolveMeta(pair: DirectPair): TokenMeta & { decimalsCertain: boolean } {
  if (pair.asset) {
    // The portfolio itself falls back to 18 when a token does not report its
    // decimals, so inherit that uncertainty rather than assuming a held token
    // is always described correctly.
    return {
      ...assetMeta(pair.asset),
      decimalsCertain: pair.asset.decimalsKnown,
    };
  }

  if (pair.meta) {
    return { ...pair.meta, decimalsCertain: true };
  }

  // Nothing describes this token. 18 is only a placeholder so formatting does
  // not crash — it is NOT a fact, and a figure derived from it would be wrong
  // by orders of magnitude for a 6-decimal token. Flag it so nothing prints the
  // amount as if it were known.
  return {
    symbol: shortenTokenAddress(pair.token),

    name: "Unrecognised token",

    decimals: 18,

    logo: null,

    decimalsCertain: false,
  };
}

export async function getApprovals(
  owner: Address,
  assets: PortfolioAsset[],
  networkId: string,
  client: PublicClient,
  options?: {
    discovered?: DiscoveredApproval[];

    coverage?: Coverage;
  },
): Promise<ApprovalScan> {
  const spenders = getKnownSpenders(networkId);

  const permit2Spenders = getPermit2Spenders(networkId);

  const tokens = assets.filter(
    (asset): asset is PortfolioAsset & { contractAddress: Address } =>
      asset.type === "erc20" && Boolean(asset.contractAddress),
  );

  const discovered = options?.discovered ?? [];

  // Build the direct-channel candidate set: every known spender against every
  // held token (bootstrap), unioned with everything discovery found. Dedupe by
  // (token, spender); a held-token entry wins so we keep balance and price.
  const directPairMap = new Map<string, DirectPair>();

  const assetByToken = new Map<string, PortfolioAsset>();

  for (const token of tokens) {
    assetByToken.set(token.contractAddress.toLowerCase(), token);
  }

  for (const token of tokens) {
    for (const spender of spenders) {
      const pair: DirectPair = {
        token: token.contractAddress,

        spender: spender.address,

        asset: token,

        meta: null,

        discovered: false,
      };

      directPairMap.set(pairKey(pair), pair);
    }
  }

  for (const candidate of discovered) {
    const asset = assetByToken.get(candidate.token.toLowerCase()) ?? null;

    const pair: DirectPair = {
      token: candidate.token,

      spender: candidate.spender,

      asset,

      meta: candidate.tokenMeta ?? null,

      discovered: true,
    };

    const key = pairKey(pair);

    const existing = directPairMap.get(key);

    if (!existing) {
      directPairMap.set(key, pair);

      continue;
    }

    // Already covered by the bootstrap; keep it but remember it was also seen in
    // history so its held-token metadata is preserved.
    if (!existing.asset && asset) {
      existing.asset = asset;
    }

    if (!existing.meta && pair.meta) {
      existing.meta = pair.meta;
    }
  }

  const directPairs = [...directPairMap.values()];

  const directCalls = directPairs.map((pair) => ({
    address: pair.token,

    abi: erc20Abi,

    functionName: "allowance" as const,

    args: [owner, pair.spender] as const,
  }));

  const permit2Calls = tokens.flatMap((token) =>
    permit2Spenders.map((spender) => ({
      address: PERMIT2_ADDRESS,

      abi: permit2Abi,

      functionName: "allowance" as const,

      args: [owner, token.contractAddress, spender] as const,
    })),
  );

  const [directResults, permit2Results] = await Promise.all([
    directCalls.length > 0
      ? client.multicall({ contracts: directCalls, allowFailure: true })
      : Promise.resolve([]),

    permit2Calls.length > 0
      ? client.multicall({ contracts: permit2Calls, allowFailure: true })
      : Promise.resolve([]),
  ]);

  if (
    directResults.length !== directCalls.length ||
    permit2Results.length !== permit2Calls.length
  ) {
    throw new Error(
      "Approval scan was answered with fewer results than it asked for",
    );
  }

  const approvals: TokenApproval[] = [];

  let expiredCount = 0;

  let uncertainDiscoveredRows = 0;

  let uncertainTruncated = false;

  const permit2Budget = new Map<string, bigint>();

  const permit2BudgetKnown = new Set<string>();

  const permit2BudgetUnread = new Set<string>();

  // Counted by token, not by call: one unreachable token must not read as five
  // separate problems just because five spenders were probed for it.
  const unreadPermit2Tokens = new Set<string>();

  function exposureOf(
    token: PortfolioAsset,
    allowanceTokens: number,
    unlimited: boolean,
  ) {
    return approvalExposureUsd({
      allowanceTokens,

      balanceTokens: Number(token.balance),

      priceUsd: token.priceUsd,

      unlimited,
    });
  }

  directResults.forEach((result, index) => {
    const pair = directPairs[index];

    const isPermit2Spender =
      pair.spender.toLowerCase() === PERMIT2_ADDRESS.toLowerCase();

    if (isPermit2Spender && result.status === "success") {
      permit2BudgetKnown.add(pair.token.toLowerCase());
    }

    if (result.status !== "success") {
      // A budget probe against the Permit2 contract is not an approval row; its
      // failure is expressed by leaving the budget unknown, which makes the
      // Permit2 permissions uncertain further down. Record it so the failure is
      // reportable — otherwise a read that never happened leaves no trace and
      // the scan looks complete.
      if (isPermit2Spender) {
        permit2BudgetUnread.add(pair.token.toLowerCase());

        return;
      }

      // A candidate we know is a real held token (bootstrap) or found in
      // history, whose current allowance cannot be read, is surfaced as
      // uncertain — never silently treated as zero.
      if (pair.discovered) {
        if (uncertainDiscoveredRows >= MAX_UNCERTAIN_DISCOVERED_ROWS) {
          uncertainTruncated = true;

          return;
        }

        uncertainDiscoveredRows += 1;
      }

      const known = findKnownSpender(networkId, pair.spender);

      const meta = resolveMeta(pair);

      approvals.push({
        id: `erc20-uncertain-${pair.token.toLowerCase()}-${pair.spender.toLowerCase()}`,

        channel: "erc20",

        token: pair.token,

        tokenSymbol: meta.symbol,

        tokenName: meta.name,

        tokenDecimals: meta.decimals,

        tokenLogo: meta.logo,

        spender: pair.spender,

        spenderName: known?.name ?? "Unknown contract",

        spenderPurpose: known?.purpose ?? "Unrecognised spender",

        allowance: 0n,

        unlimited: false,

        allowanceCertain: false,

        decimalsCertain: meta.decimalsCertain,

        expiresAt: null,

        exposureUsd: null,

        exposureCertain: false,

        risk: scoreApproval({
          unlimited: false,

          exposureUsd: null,

          spenderKnown: known !== null,

          holdsTokens: true,
        }),
      });

      return;
    }

    const allowance = result.result as bigint;

    if (allowance <= 0n) {
      return;
    }

    const unlimited = allowance >= UNLIMITED_THRESHOLD;

    if (isPermit2Spender) {
      permit2Budget.set(pair.token.toLowerCase(), allowance);
    }

    const known = findKnownSpender(networkId, pair.spender);

    const meta = resolveMeta(pair);

    const exposureUsd = pair.asset
      ? exposureOf(
          pair.asset,
          Number(formatUnits(allowance, meta.decimals)),
          unlimited,
        )
      : null;

    const holdsTokens = pair.asset
      ? !Number.isFinite(Number(pair.asset.balance)) ||
        Number(pair.asset.balance) > 0
      : true;

    approvals.push({
      id: `erc20-${pair.token.toLowerCase()}-${pair.spender.toLowerCase()}`,

      channel: "erc20",

      token: pair.token,

      tokenSymbol: meta.symbol,

      tokenName: meta.name,

      tokenDecimals: meta.decimals,

      tokenLogo: meta.logo,

      spender: pair.spender,

      spenderName: known?.name ?? "Unknown contract",

      spenderPurpose: known?.purpose ?? "Unrecognised spender",

      allowance,

      unlimited,

      allowanceCertain: true,

      decimalsCertain: meta.decimalsCertain,

      expiresAt: null,

      exposureUsd,

      exposureCertain: exposureUsd !== null,

      risk: scoreApproval({
        unlimited,

        exposureUsd,

        spenderKnown: known !== null,

        holdsTokens,
      }),
    });
  });

  permit2Results.forEach((result, index) => {
    if (result.status !== "success") {
      // Same rule as the budget probe: a read that did not happen must leave a
      // trace. Without this the scan cannot tell "no Permit2 permission" from
      // "we never found out", and the review would call itself finished.
      const failedToken = tokens[Math.floor(index / permit2Spenders.length)];

      if (failedToken) {
        unreadPermit2Tokens.add(failedToken.contractAddress.toLowerCase());
      }

      return;
    }

    const [amount, expiration] = result.result as readonly [
      bigint,
      number,
      number,
    ];

    if (amount <= 0n) {
      return;
    }

    if (isPermit2Expired(expiration)) {
      expiredCount += 1;

      return;
    }

    const token = tokens[Math.floor(index / permit2Spenders.length)];

    const spenderAddress = permit2Spenders[index % permit2Spenders.length];

    const tokenKey = token.contractAddress.toLowerCase();

    const budgetKnown = permit2BudgetKnown.has(tokenKey);

    const budget = permit2Budget.get(tokenKey) ?? 0n;

    if (budgetKnown && budget <= 0n) {
      return;
    }

    const known = findKnownSpender(networkId, spenderAddress);

    const unlimited = amount >= PERMIT2_UNLIMITED;

    const effective = !budgetKnown ? amount : amount < budget ? amount : budget;

    const exposureUsd = exposureOf(
      token,
      Number(formatUnits(effective, token.decimals)),
      unlimited && (!budgetKnown || budget >= UNLIMITED_THRESHOLD),
    );

    approvals.push({
      id: `permit2-${token.contractAddress.toLowerCase()}-${spenderAddress.toLowerCase()}`,

      channel: "permit2",

      token: token.contractAddress,

      tokenSymbol: token.symbol,

      tokenName: token.name,

      tokenDecimals: token.decimals,

      tokenLogo: token.logo,

      spender: spenderAddress,

      spenderName: known?.name ?? "Unknown contract",

      spenderPurpose: known?.purpose ?? "Unrecognised spender",

      allowance: amount,

      unlimited,

      allowanceCertain: true,

      decimalsCertain: token.decimalsKnown,

      expiresAt: expiration,

      exposureUsd,

      exposureCertain: exposureUsd !== null && budgetKnown,

      risk: scoreApproval({
        unlimited,
        exposureUsd,
        spenderKnown: known !== null,
        holdsTokens: !Number.isFinite(Number(token.balance)) || Number(token.balance) > 0,
      }),
    });
  });

  const riskOrder: Record<ApprovalRisk, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  approvals.sort((a, b) => {
    if (a.risk !== b.risk) {
      return riskOrder[a.risk] - riskOrder[b.risk];
    }

    const aUnknown = a.exposureUsd === null;

    const bUnknown = b.exposureUsd === null;

    // An exposure we could not determine ranks above any figure we could. It
    // cannot be honestly compared by size, so it must never be sorted as if it
    // were zero and buried under smaller, merely-known amounts.
    if (aUnknown !== bUnknown) {
      return aUnknown ? -1 : 1;
    }

    return (b.exposureUsd ?? 0) - (a.exposureUsd ?? 0);
  });

  const exposureByToken = new Map<string, number>();

  for (const token of tokens) {
    const key = token.contractAddress.toLowerCase();

    const balanceTokens = Number(token.balance);

    if (token.priceUsd === null || !Number.isFinite(balanceTokens)) {
      continue;
    }

    const rows = approvals.filter(
      (approval) =>
        approval.token.toLowerCase() === key && approval.allowanceCertain,
    );

    const cap = (value: number) => Math.min(value, balanceTokens);

    const reachOf = (approval: TokenApproval) =>
      cap(
        approval.unlimited
          ? balanceTokens
          : Number(formatUnits(approval.allowance, approval.tokenDecimals)),
      );

    const directReach = rows
      .filter((approval) => approval.channel === "erc20")
      .reduce((total, approval) => total + reachOf(approval), 0);

    const permit2Reach = rows
      .filter((approval) => approval.channel === "permit2")
      .reduce((total, approval) => total + reachOf(approval), 0);

    const budgetCounted = permit2BudgetKnown.has(key);

    const reachable = Math.min(
      balanceTokens,
      directReach + (budgetCounted ? 0 : permit2Reach),
    );

    exposureByToken.set(key, reachable * token.priceUsd);
  }

  const totalExposureUsd = [...exposureByToken.values()].reduce(
    (total, value) => total + value,
    0,
  );

  const uncertainCount = approvals.filter(
    (approval) => !approval.exposureCertain,
  ).length;

  const knownSet = new Set(spenders.map((spender) => spender.address.toLowerCase()));

  const unknownSpenderCount = new Set(
    approvals
      .filter(
        (approval) =>
          approval.allowanceCertain &&
          !knownSet.has(approval.spender.toLowerCase()),
      )
      .map((approval) => approval.spender.toLowerCase()),
  ).size;

  const requestedCoverage = options?.coverage ?? "complete";

  const coverage: Coverage =
    uncertainTruncated || requestedCoverage === "partial"
      ? "partial"
      : "complete";

  return {
    approvals,

    totalExposureUsd,

    checkedTokens: tokens.length,

    checkedSpenders: countDistinctSpenders(spenders, permit2Spenders),

    expiredCount,

    uncertainCount,

    coverage,

    unknownSpenderCount,

    unreadBudgetCount: permit2BudgetUnread.size,

    unreadPermit2Count: unreadPermit2Tokens.size,

    permit2SpendersChecked: permit2Spenders.length,
  };
}
