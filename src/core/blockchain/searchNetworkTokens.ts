import { getAddress, isAddress, type Address } from "viem";

import { ACTIVE_NETWORK } from "@/constants/networks";

import type { AssetSearchResult } from "./assetSearch";
import { getTokenMetadata } from "./getTokenMetadata";

type GeckoToken = {
  id: string;

  type: "token";

  attributes: {
    address: string;
    name: string;
    symbol: string;
    decimals?: number;

    image_url?: string | null;
  };
};

type GeckoSearchResponse = {
  included?: GeckoToken[];
};

function matchesQuery(token: GeckoToken, query: string) {
  const value = query.toLowerCase();

  return (
    token.attributes.name.toLowerCase().includes(value) ||
    token.attributes.symbol.toLowerCase().includes(value) ||
    token.attributes.address.toLowerCase() === value
  );
}

export async function searchNetworkTokens(
  rawQuery: string,
): Promise<AssetSearchResult[]> {
  const query = rawQuery.trim();

  if (!query) {
    return [];
  }

  if (
    isAddress(query, {
      strict: false,
    })
  ) {
    const metadata = await getTokenMetadata(query);

    if (!metadata) {
      return [];
    }

    return [
      {
        type: "erc20",

        symbol: metadata.symbol,

        name: metadata.name,

        contractAddress: metadata.address,

        logo: metadata.logo,

        source: "network",

        balance: null,
      },
    ];
  }

  const network = ACTIVE_NETWORK.tokenSearchNetwork;

  if (!network) {
    return [];
  }

  const params = new URLSearchParams({
    query,

    network,

    include: "base_token,quote_token",
  });

  const response = await fetch(
    `https://api.geckoterminal.com/api/v2/search/pools?${params.toString()}`,
    {
      headers: {
        Accept: "application/json",
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Token search failed: ${response.status}`);
  }

  const result = (await response.json()) as GeckoSearchResponse;

  const tokens = result.included ?? [];

  const seen = new Set<string>();

  const results: AssetSearchResult[] = [];

  for (const token of tokens) {
    if (token.type !== "token") {
      continue;
    }

    if (!matchesQuery(token, query)) {
      continue;
    }

    if (!isAddress(token.attributes.address)) {
      continue;
    }

    const address = getAddress(token.attributes.address);

    const key = address.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    results.push({
      type: "erc20",

      symbol: token.attributes.symbol,

      name: token.attributes.name,

      contractAddress: address as Address,

      logo: token.attributes.image_url ?? null,

      source: "network",

      balance: null,
    });
  }

  return results.slice(0, 20);
}
