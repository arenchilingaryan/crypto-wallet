import { DEFAULT_NETWORK } from "@/constants/networks";
import { formatUnits, type Address } from "viem";

export type PortfolioAsset = {
  type: "native" | "erc20";
  symbol: string;
  name: string;
  balance: string;
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
  tokenMetadata?: {
    decimals?: number;
    logo?: string;
    name?: string;
    symbol?: string;
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

const API_KEY = process.env.EXPO_PUBLIC_ALCHEMY_API_KEY;

export async function getPortfolio(address: Address): Promise<Portfolio> {
  if (!API_KEY) {
    throw new Error("Alchemy API key is missing");
  }

  const response = await fetch(
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
            networks: [DEFAULT_NETWORK.id],
          },
        ],
        withMetadata: true,
        withPrices: true,
        includeNativeTokens: true,
        includeErc20Tokens: true,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Alchemy request failed: ${response.status}`);
  }

  const result = (await response.json()) as AlchemyPortfolioResponse;

  const assets = result.data.tokens
    .map((token): PortfolioAsset => {
      const isNative = !token.tokenAddress;

      const decimals = isNative ? 18 : token.tokenMetadata?.decimals;

      let balance = token.tokenBalance;

      if (balance.startsWith("0x") && decimals !== undefined) {
        balance = formatUnits(BigInt(balance), decimals);
      }

      const price =
        token.tokenPrices?.find((item) => item.currency === "usd")?.value ??
        null;

      const priceUsd = price !== null ? Number(price) : null;

      const numericBalance = Number(balance);

      const valueUsd =
        priceUsd !== null && Number.isFinite(numericBalance)
          ? numericBalance * priceUsd
          : null;

      return {
        type: isNative ? "native" : "erc20",

        symbol: isNative ? "ETH" : (token.tokenMetadata?.symbol ?? "UNKNOWN"),

        name: isNative
          ? "Ethereum"
          : (token.tokenMetadata?.name ?? "Unknown token"),

        balance,

        priceUsd,
        valueUsd,

        logo: token.tokenMetadata?.logo ?? null,

        contractAddress:
          !isNative && token.tokenAddress?.startsWith("0x")
            ? (token.tokenAddress as Address)
            : undefined,
      };
    })
    .filter((asset) => asset.type === "native" || Number(asset.balance) > 0)
    .sort((a, b) => {
      if (a.type === "native" && b.type !== "native") {
        return -1;
      }

      if (b.type === "native" && a.type !== "native") {
        return 1;
      }

      return (b.valueUsd ?? 0) - (a.valueUsd ?? 0);
    });

  const totalUsd = assets.reduce(
    (total, asset) => total + (asset.valueUsd ?? 0),
    0,
  );

  return {
    network: DEFAULT_NETWORK.name,
    networkId: DEFAULT_NETWORK.id,
    totalUsd,
    assets,
  };
}
