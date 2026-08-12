import { ACTIVE_NETWORK } from "@/constants/networks";

import { formatUnits, type Address } from "viem";

import { findKnownTokenByAddress } from "./knownTokens";

export type PortfolioAsset = {
  type: "native" | "erc20";

  symbol: string;

  name: string;

  balance: string;

  /** Знаки после запятой у токена — нужны, чтобы читать сырые суммы. */
  decimals: number;

  priceUsd: number | null;

  valueUsd: number | null;

  logo: string | null;

  contractAddress?: Address;
};

export type Portfolio = {
  network: string;

  networkId: string;

  totalUsd: number;

  assets: PortfolioAsset[];
};

type AlchemyToken = {
  address: string;

  network: string;

  tokenAddress: string | null;

  tokenBalance: string;

  // Alchemy отдаёт null-поля для токенов без верифицированных метаданных —
  // на тестнетах это обычное дело.
  tokenMetadata?: {
    decimals?: number | null;

    logo?: string | null;

    name?: string | null;

    symbol?: string | null;
  };

  tokenPrices?: {
    currency: string;

    value: string;

    lastUpdatedAt: string;
  }[];
};

type AlchemyPortfolioResponse = {
  data: {
    tokens: AlchemyToken[];

    pageKey?: string;
  };
};

type AlchemyBalanceResponse = {
  jsonrpc: "2.0";

  id: number;

  result?: `0x${string}`;

  error?: {
    code: number;

    message: string;
  };
};

const API_KEY = process.env.EXPO_PUBLIC_ALCHEMY_API_KEY;

function getUsdPrice(token: AlchemyToken | undefined) {
  const price =
    token?.tokenPrices?.find((item) => item.currency === "usd")?.value ?? null;

  if (price === null) {
    return null;
  }

  const numeric = Number(price);

  return Number.isFinite(numeric) ? numeric : null;
}

export async function getPortfolio(address: Address): Promise<Portfolio> {
  if (!API_KEY) {
    throw new Error("Alchemy API key is missing");
  }

  const [portfolioResponse, balanceResponse] = await Promise.all([
    fetch(
      `https://api.g.alchemy.com/data/v1/${API_KEY}/assets/tokens/by-address`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          addresses: [
            {
              address,

              networks: [ACTIVE_NETWORK.id],
            },
          ],

          withMetadata: true,

          withPrices: true,

          includeNativeTokens: true,

          includeErc20Tokens: true,
        }),
      },
    ),

    fetch(`https://${ACTIVE_NETWORK.id}.g.alchemy.com/v2/${API_KEY}`, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        jsonrpc: "2.0",

        id: 1,

        method: "eth_getBalance",

        params: [address, "latest"],
      }),
    }),
  ]);

  if (!portfolioResponse.ok) {
    throw new Error(
      `Alchemy portfolio request failed: ${portfolioResponse.status}`,
    );
  }

  if (!balanceResponse.ok) {
    throw new Error(
      `Alchemy balance request failed: ${balanceResponse.status}`,
    );
  }

  const portfolioResult =
    (await portfolioResponse.json()) as AlchemyPortfolioResponse;

  const balanceResult =
    (await balanceResponse.json()) as AlchemyBalanceResponse;

  if (!balanceResult.result) {
    throw new Error(
      balanceResult.error?.message ?? "Failed to load native balance",
    );
  }

  const nativeToken = portfolioResult.data.tokens.find(
    (token) => !token.tokenAddress,
  );

  const nativeBalance = formatUnits(BigInt(balanceResult.result), 18);

  const nativePrice = getUsdPrice(nativeToken);

  const nativeNumericBalance = Number(nativeBalance);

  const nativeValueUsd =
    nativePrice !== null && Number.isFinite(nativeNumericBalance)
      ? nativeNumericBalance * nativePrice
      : null;

  const nativeAsset: PortfolioAsset = {
    type: "native",

    symbol: ACTIVE_NETWORK.nativeSymbol,

    name: "Ethereum",

    balance: nativeBalance,

    decimals: 18,

    priceUsd: nativePrice,

    valueUsd: nativeValueUsd,

    logo: nativeToken?.tokenMetadata?.logo ?? null,
  };

  const erc20Assets = portfolioResult.data.tokens
    .filter((token) => Boolean(token.tokenAddress))
    .map((token): PortfolioAsset => {
      const decimals = token.tokenMetadata?.decimals;

      let balance = token.tokenBalance;

      // null-decimals ведут себя как отсутствующие: hex-баланс не
      // разворачивается, и актив ниже отсеивается фильтром Number(...) > 0.
      if (balance.startsWith("0x") && typeof decimals === "number") {
        balance = formatUnits(BigInt(balance), decimals);
      }

      const priceUsd = getUsdPrice(token);

      const numericBalance = Number(balance);

      const valueUsd =
        priceUsd !== null && Number.isFinite(numericBalance)
          ? numericBalance * priceUsd
          : null;

      return {
        type: "erc20",

        symbol: token.tokenMetadata?.symbol ?? "UNKNOWN",

        name: token.tokenMetadata?.name ?? "Unknown token",

        balance,

        decimals: decimals ?? 18,

        priceUsd,

        valueUsd,

        // Alchemy на тестнете логотипов почти не отдаёт —
        // добираем из курируемого реестра.
        logo:
          token.tokenMetadata?.logo ??
          (token.tokenAddress?.startsWith("0x")
            ? (findKnownTokenByAddress(
                ACTIVE_NETWORK.id,
                token.tokenAddress as Address,
              )?.logo ?? null)
            : null),

        contractAddress: token.tokenAddress?.startsWith("0x")
          ? (token.tokenAddress as Address)
          : undefined,
      };
    })
    .filter((asset) => Number(asset.balance) > 0)
    .sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0));

  const assets = [nativeAsset, ...erc20Assets];

  const totalUsd = assets.reduce(
    (total, asset) => total + (asset.valueUsd ?? 0),
    0,
  );

  return {
    network: ACTIVE_NETWORK.name,

    networkId: ACTIVE_NETWORK.id,

    totalUsd,

    assets,
  };
}
