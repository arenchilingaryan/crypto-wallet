import { getAddress, isAddress, type Address } from "viem";

import { ACTIVE_NETWORK } from "@/constants/networks";

import { getDataApiKey } from "@/core/config/runtimeConfig";

export type TokenMetadata = {
  address: Address;
  name: string;
  symbol: string;
  decimals: number;
  logo: string | null;
};

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
  const API_KEY = getDataApiKey();

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
    // A JSON-RPC error is a provider failure, not evidence that the contract has
    // no metadata. Keep that distinction so callers cannot turn an outage or
    // rate limit into an authoritative "token not found" result.
    throw new Error("Token metadata provider returned a JSON-RPC error");
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
