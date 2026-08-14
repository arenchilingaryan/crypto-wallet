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

export type ApprovalChannel = "erc20" | "permit2";

export type ApprovalRisk = "low" | "medium" | "high" | "critical";

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
};

const UNLIMITED_THRESHOLD = 2n ** 255n;

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

export async function getApprovals(
  owner: Address,
  assets: PortfolioAsset[],
  networkId: string,
  client: PublicClient,
): Promise<ApprovalScan> {
  const spenders = getKnownSpenders(networkId);

  const permit2Spenders = getPermit2Spenders(networkId);

  const tokens = assets.filter(
    (asset): asset is PortfolioAsset & { contractAddress: Address } =>
      asset.type === "erc20" && Boolean(asset.contractAddress),
  );

  if (
    tokens.length === 0 ||
    (spenders.length === 0 && permit2Spenders.length === 0)
  ) {
    return {
      approvals: [],
      totalExposureUsd: 0,
      checkedTokens: tokens.length,
      checkedSpenders: countDistinctSpenders(spenders, permit2Spenders),
      expiredCount: 0,
      uncertainCount: 0,
    };
  }

  const directCalls = tokens.flatMap((token) =>
    spenders.map((spender) => ({
      address: token.contractAddress,

      abi: erc20Abi,

      functionName: "allowance" as const,

      args: [owner, spender.address] as const,
    })),
  );

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

  const permit2Budget = new Map<string, bigint>();

  const permit2BudgetKnown = new Set<string>();

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
    const token = tokens[Math.floor(index / spenders.length)];

    const spender = spenders[index % spenders.length];

    if (spender.address.toLowerCase() === PERMIT2_ADDRESS.toLowerCase()) {
      if (result.status === "success") {
        permit2BudgetKnown.add(token.contractAddress.toLowerCase());
      }
    }

    if (result.status !== "success") {
      return;
    }

    const allowance = result.result as bigint;

    if (allowance <= 0n) {
      return;
    }

    const unlimited = allowance >= UNLIMITED_THRESHOLD;

    if (spender.address.toLowerCase() === PERMIT2_ADDRESS.toLowerCase()) {
      permit2Budget.set(token.contractAddress.toLowerCase(), allowance);
    }

    const exposureUsd = exposureOf(
      token,
      Number(formatUnits(allowance, token.decimals)),
      unlimited,
    );

    approvals.push({
      id: `erc20-${token.contractAddress.toLowerCase()}-${spender.address.toLowerCase()}`,

      channel: "erc20",

      token: token.contractAddress,

      tokenSymbol: token.symbol,

      tokenName: token.name,

      tokenDecimals: token.decimals,

      tokenLogo: token.logo,

      spender: spender.address,

      spenderName: spender.name,

      spenderPurpose: spender.purpose,

      allowance,

      unlimited,

      expiresAt: null,

      exposureUsd,

      exposureCertain: exposureUsd !== null,

      risk: scoreApproval({
        unlimited,
        exposureUsd,
        spenderKnown: true,
        holdsTokens: !Number.isFinite(Number(token.balance)) || Number(token.balance) > 0,
      }),
    });
  });

  permit2Results.forEach((result, index) => {
    if (result.status !== "success") {
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
      (approval) => approval.token.toLowerCase() === key,
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

  return {
    approvals,

    totalExposureUsd,

    checkedTokens: tokens.length,

    checkedSpenders: countDistinctSpenders(spenders, permit2Spenders),

    expiredCount,

    uncertainCount,
  };
}
