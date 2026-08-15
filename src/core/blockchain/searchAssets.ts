import type { Address } from "viem";

import type { AssetSearchResult } from "./assetSearch";
import { classifyAssetSearchQuery } from "./classifyAssetSearchQuery";
import type { Portfolio } from "./getPortfolio";
import {
  searchNetworkTokens,
  type TokenSearchCatalogue,
} from "./searchNetworkTokens";

function mapPortfolioAsset(
  asset: Portfolio["assets"][number],
): AssetSearchResult {
  return {
    type: asset.type,

    symbol: asset.symbol,

    name: asset.name,

    contractAddress: asset.contractAddress ?? null,

    logo: asset.logo,

    source: asset.type === "native" ? "native" : "wallet",

    balance: asset.balance,
  };
}

function getAllPortfolioAssets(portfolio: Portfolio): AssetSearchResult[] {
  return portfolio.assets.map(mapPortfolioAsset);
}

function searchPortfolioByText(
  portfolio: Portfolio,
  query: string,
): AssetSearchResult[] {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return getAllPortfolioAssets(portfolio);
  }

  return portfolio.assets
    .filter((asset) => {
      const name = asset.name.toLowerCase();

      const symbol = asset.symbol.toLowerCase();

      return name.includes(normalized) || symbol.includes(normalized);
    })
    .map(mapPortfolioAsset);
}

function findPortfolioTokenByAddress(
  portfolio: Portfolio,
  address: Address,
): AssetSearchResult | null {
  const normalizedAddress = address.toLowerCase();

  const asset = portfolio.assets.find(
    (item) =>
      item.type === "erc20" &&
      item.contractAddress?.toLowerCase() === normalizedAddress,
  );

  if (!asset) {
    return null;
  }

  return mapPortfolioAsset(asset);
}

function mergeResults(
  local: AssetSearchResult[],
  remote: AssetSearchResult[],
): AssetSearchResult[] {
  const result = [...local];

  const seen = new Set<string>();

  for (const asset of local) {
    if (asset.type === "native") {
      seen.add("native");

      continue;
    }

    if (asset.contractAddress) {
      seen.add(asset.contractAddress.toLowerCase());
    }
  }

  for (const asset of remote) {
    const key =
      asset.type === "native" ? "native" : asset.contractAddress?.toLowerCase();

    if (!key) {
      continue;
    }

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    result.push(asset);
  }

  return result;
}

export type AssetSearch = {
  results: AssetSearchResult[];

  // Whether the wider token catalogue could be consulted. "unavailable" means
  // the list is what we hold locally, not the whole answer — a caller must not
  // present it as "no such token".
  catalogue: TokenSearchCatalogue;
};

export async function searchAssets(
  portfolio: Portfolio,
  rawQuery: string,
): Promise<AssetSearch> {
  const query = classifyAssetSearchQuery(rawQuery);

  // The wallet's own assets are local facts; nothing external is consulted, so
  // these answers are complete by construction.
  if (query.type === "empty") {
    return {
      results: getAllPortfolioAssets(portfolio),
      catalogue: "complete",
    };
  }

  if (query.type === "address") {
    const local = findPortfolioTokenByAddress(portfolio, query.address);

    if (local) {
      return { results: [local], catalogue: "complete" };
    }

    return searchNetworkTokens(query.address);
  }

  const local = searchPortfolioByText(portfolio, query.query);

  const remote = await searchNetworkTokens(query.query);

  return {
    results: mergeResults(local, remote.results),

    catalogue: remote.catalogue,
  };
}
