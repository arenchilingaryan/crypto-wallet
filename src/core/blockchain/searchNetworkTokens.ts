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

// The provider is untrusted input. `included` is documented as a list, but a
// valid JSON body can carry an object, a string, or entries missing the
// fields below — and every one of those escapes the fetch/parse try block as
// a raw TypeError on the render path instead of an unavailable catalogue.
const MAX_CATALOGUE_ITEMS = 200;

function isGeckoToken(value: unknown): value is GeckoToken {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const attributes = (value as { attributes?: unknown }).attributes;

  if (typeof attributes !== "object" || attributes === null) {
    return false;
  }

  const { address, name, symbol } = attributes as Record<string, unknown>;

  return (
    typeof address === "string" &&
    typeof name === "string" &&
    typeof symbol === "string"
  );
}

function normalizeCatalogue(included: unknown): GeckoToken[] {
  if (included === undefined || included === null) {
    return [];
  }

  if (!Array.isArray(included)) {
    throw new Error("Token search returned a malformed catalogue");
  }

  return included.slice(0, MAX_CATALOGUE_ITEMS).filter(isGeckoToken);
}

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
  // Which catalogue to consult, defaulting to the active network's. Passed
  // explicitly by tests so their meaning does not quietly change with the
  // network this build happens to be pinned to.
  searchNetwork: string | null = ACTIVE_NETWORK.tokenSearchNetwork,
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

    let metadata: Awaited<ReturnType<typeof getTokenMetadata>>;

    try {
      metadata = await getTokenMetadata(query);
    } catch (metadataError) {
      console.error("Token metadata lookup unavailable:", metadataError);

      return { results: [], catalogue: "unavailable" };
    }

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

  const network = searchNetwork;

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

    // Normalisation stays inside the try: a malformed shape is a provider
    // failure like any other, and must degrade to "unavailable" rather than
    // escape into the caller as an iteration error.
    tokens = normalizeCatalogue(result?.included);
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
