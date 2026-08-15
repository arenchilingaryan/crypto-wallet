import { getAddress, isAddress, type Address } from "viem";

import { ACTIVE_NETWORK } from "@/constants/networks";

import type { AssetSearchResult } from "./assetSearch";
import { getTokenMetadata } from "./getTokenMetadata";
import {
  findKnownTokenByAddress,
  searchKnownTokensByText,
  type KnownToken,
} from "./knownTokens";

function mapKnownToken(token: KnownToken): AssetSearchResult {
  return {
    type: "erc20",

    symbol: token.symbol,

    name: token.name,

    contractAddress: token.address,

    logo: token.logo,

    source: "network",

    balance: null,
  };
}

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

// "We searched and found nothing" and "we could not search" look identical in a
// bare array, and the second one told as the first is how a user concludes a
// token does not exist when in truth the catalogue was simply unreachable.
export type TokenSearchCatalogue = "complete" | "unavailable";

export type NetworkTokenSearch = {
  results: AssetSearchResult[];

  catalogue: TokenSearchCatalogue;
};

export async function searchNetworkTokens(
  rawQuery: string,
): Promise<NetworkTokenSearch> {
  const query = rawQuery.trim();

  if (!query) {
    return { results: [], catalogue: "complete" };
  }

  if (
    isAddress(query, {
      strict: false,
    })
  ) {
    const known = findKnownTokenByAddress(ACTIVE_NETWORK.id, getAddress(query));

    if (known) {
      return { results: [mapKnownToken(known)], catalogue: "complete" };
    }

    const metadata = await getTokenMetadata(query);

    if (!metadata) {
      return { results: [], catalogue: "complete" };
    }

    return {
      catalogue: "complete",

      results: [
        {
          type: "erc20",

          symbol: metadata.symbol,

          name: metadata.name,

          contractAddress: metadata.address,

          logo: metadata.logo,

          source: "network",

          balance: null,
        },
      ],
    };
  }

  const knownMatches = searchKnownTokensByText(ACTIVE_NETWORK.id, query).map(
    mapKnownToken,
  );

  const network = ACTIVE_NETWORK.tokenSearchNetwork;

  if (!network) {
    // This network has no wider catalogue at all — the local list is the whole
    // truth here, not a degraded version of something bigger.
    return { results: knownMatches, catalogue: "complete" };
  }

  const params = new URLSearchParams({
    query,

    network,

    include: "base_token,quote_token",
  });

  // The wider catalogue is a third party on a shared free tier: it rate-limits
  // and goes down. When it does, fall back to what this app already knows
  // rather than throwing — otherwise one unavailable service also erases the
  // curated tokens we hold locally, and the user cannot even pick a well-known
  // one. A narrower result is honest; an empty screen is not.
  let tokens: GeckoSearchResponse["included"] = [];

  try {
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

    tokens = result.included ?? [];
  } catch (searchError) {
    console.error("Wider token search unavailable:", searchError);

    return { results: knownMatches, catalogue: "unavailable" };
  }

  const seen = new Set<string>(
    knownMatches
      .map((token) => token.contractAddress?.toLowerCase())
      .filter((address): address is string => Boolean(address)),
  );

  const results: AssetSearchResult[] = [...knownMatches];

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

  return { results: results.slice(0, 20), catalogue: "complete" };
}
