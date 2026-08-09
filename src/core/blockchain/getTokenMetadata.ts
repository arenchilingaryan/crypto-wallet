import { getAddress, isAddress, type Address } from "viem";

import { ACTIVE_NETWORK } from "@/constants/networks";

export type TokenMetadata = {
  address: Address;
  name: string;
  symbol: string;
  decimals: number;
  logo: string | null;
};

const API_KEY = process.env.EXPO_PUBLIC_ALCHEMY_API_KEY;

type AlchemyResponse = {
  result?: {
    name?: string | null;
    symbol?: string | null;
    decimals?: number | null;
    logo?: string | null;
  };

  error?: {
    message?: string;
  };
};

export async function getTokenMetadata(
  contractAddress: string,
): Promise<TokenMetadata | null> {
  if (!API_KEY) {
    throw new Error("Alchemy API key is missing");
  }

  if (
    !isAddress(contractAddress, {
      strict: false,
    })
  ) {
    return null;
  }

  const address = getAddress(contractAddress);

  const response = await fetch(
    `https://${ACTIVE_NETWORK.id}.g.alchemy.com/v2/${API_KEY}`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,

        method: "alchemy_getTokenMetadata",

        params: [address],
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Token metadata request failed: ${response.status}`);
  }

  const result = (await response.json()) as AlchemyResponse;

  if (result.error) {
    return null;
  }

  const metadata = result.result;

  if (
    !metadata ||
    !metadata.symbol ||
    metadata.decimals === undefined ||
    metadata.decimals === null
  ) {
    return null;
  }

  return {
    address,

    symbol: metadata.symbol,

    name: metadata.name ?? metadata.symbol,

    decimals: metadata.decimals,

    logo: metadata.logo ?? null,
  };
}
