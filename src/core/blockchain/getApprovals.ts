import { formatUnits, type Address, type PublicClient } from "viem";

import { erc20Abi } from "./erc20Abi";
import { getKnownSpenders } from "./knownSpenders";
import type { PortfolioAsset } from "./getPortfolio";

export type TokenApproval = {
  /** Стабильный ключ для списков: токен + спендер. */
  id: string;

  token: Address;

  tokenSymbol: string;

  tokenName: string;

  tokenDecimals: number;

  tokenLogo: string | null;

  spender: Address;

  spenderName: string;

  spenderPurpose: string;

  allowance: bigint;

  /** Разрешение, покрывающее любой мыслимый баланс. */
  unlimited: boolean;

  /** Сколько денег реально под риском: min(баланс, разрешение). */
  exposureUsd: number | null;
};

export type ApprovalScan = {
  approvals: TokenApproval[];

  /** Сколько токенов и спендеров реально проверено — для честной плашки. */
  checkedTokens: number;

  checkedSpenders: number;
};

// Бесконечным считаем всё, что больше половины uint256: именно так
// выглядят стандартные MaxUint256 и его «почти максимальные» варианты.
const UNLIMITED_THRESHOLD = 2n ** 255n;

export async function getApprovals(
  owner: Address,
  assets: PortfolioAsset[],
  networkId: string,
  client: PublicClient,
): Promise<ApprovalScan> {
  const spenders = getKnownSpenders(networkId);

  const tokens = assets.filter(
    (asset): asset is PortfolioAsset & { contractAddress: Address } =>
      asset.type === "erc20" && Boolean(asset.contractAddress),
  );

  if (tokens.length === 0 || spenders.length === 0) {
    return {
      approvals: [],

      checkedTokens: tokens.length,

      checkedSpenders: spenders.length,
    };
  }

  const contracts = tokens.flatMap((token) =>
    spenders.map((spender) => ({
      address: token.contractAddress,

      abi: erc20Abi,

      functionName: "allowance" as const,

      args: [owner, spender.address] as const,
    })),
  );

  // Один multicall на всю матрицу токен×спендер: столько же данных,
  // один round-trip вместо десятков.
  const results = await client.multicall({
    contracts,

    allowFailure: true,
  });

  const approvals: TokenApproval[] = [];

  results.forEach((result, index) => {
    if (result.status !== "success") {
      return;
    }

    const allowance = result.result as bigint;

    if (allowance <= 0n) {
      return;
    }

    const token = tokens[Math.floor(index / spenders.length)];

    const spender = spenders[index % spenders.length];

    const decimals = token.decimals;

    const unlimited = allowance >= UNLIMITED_THRESHOLD;

    // Под риском не «разрешение», а то, что оно способно унести:
    // разрешение на миллион при балансе в десять стоит десять.
    const allowanceTokens = Number(formatUnits(allowance, decimals));

    const balanceTokens = Number(token.balance);

    const exposureTokens = unlimited
      ? balanceTokens
      : Math.min(allowanceTokens, balanceTokens);

    const exposureUsd =
      token.priceUsd !== null && Number.isFinite(exposureTokens)
        ? exposureTokens * token.priceUsd
        : null;

    approvals.push({
      id: `${token.contractAddress.toLowerCase()}-${spender.address.toLowerCase()}`,

      token: token.contractAddress,

      tokenSymbol: token.symbol,

      tokenName: token.name,

      tokenDecimals: decimals,

      tokenLogo: token.logo,

      spender: spender.address,

      spenderName: spender.name,

      spenderPurpose: spender.purpose,

      allowance,

      unlimited,

      exposureUsd,
    });
  });

  // Сначала то, что реально дорого потерять.
  approvals.sort((a, b) => {
    const left = a.exposureUsd ?? 0;

    const right = b.exposureUsd ?? 0;

    if (left !== right) {
      return right - left;
    }

    return Number(b.unlimited) - Number(a.unlimited);
  });

  return {
    approvals,

    checkedTokens: tokens.length,

    checkedSpenders: spenders.length,
  };
}
