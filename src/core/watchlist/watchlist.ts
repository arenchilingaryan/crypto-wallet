import { isAddress, type Address } from "viem";

import type {
  WatchedAssetId,
  WatchedToken,
  WatchlistAddResult,
} from "./types";

// A hard product limit, enforced by refusing the addition. There is deliberately
// no eviction: silently dropping the oldest entry would delete something the
// user chose to keep, without telling them.
export const MAX_WATCHLIST_ITEMS = 50;

// Canonical comparison key. Address casing is display only (EIP-55 checksums
// carry no identity), so it is lowered exactly once, here.
export function watchKey(id: WatchedAssetId): string {
  return `${id.chainId}:${id.address.toLowerCase()}`;
}

export function sameWatchedAsset(a: WatchedAssetId, b: WatchedAssetId): boolean {
  return watchKey(a) === watchKey(b);
}

export function isValidWatchedAssetId(value: {
  chainId: unknown;
  address: unknown;
}): boolean {
  return (
    typeof value.chainId === "number" &&
    Number.isInteger(value.chainId) &&
    value.chainId > 0 &&
    typeof value.address === "string" &&
    isAddress(value.address, { strict: false })
  );
}

export function normalizeWatchedAssetId(id: WatchedAssetId): WatchedAssetId {
  return {
    chainId: id.chainId,

    address: id.address.toLowerCase() as Address,
  };
}

export function isWatched(
  items: readonly WatchedToken[],
  id: WatchedAssetId,
): boolean {
  const key = watchKey(id);

  return items.some((item) => watchKey(item) === key);
}

// Adding is idempotent: watching something already watched is a no-op that
// reports success, not a duplicate row and not an error.
export function addWatched(
  items: readonly WatchedToken[],
  id: WatchedAssetId,
  addedAt: number,
): WatchlistAddResult {
  // The writer must refuse exactly what the reader would discard. Otherwise an
  // entry is accepted, written, and then silently vanishes on the next restart —
  // the store would contradict itself.
  if (!isValidWatchedAssetId(id)) {
    return { ok: false, reason: "invalid-asset" };
  }

  if (isWatched(items, id)) {
    return { ok: true, items: [...items], alreadyWatched: true };
  }

  if (items.length >= MAX_WATCHLIST_ITEMS) {
    return { ok: false, reason: "limit-reached" };
  }

  const normalized = normalizeWatchedAssetId(id);

  return {
    ok: true,

    items: [...items, { ...normalized, addedAt }],

    alreadyWatched: false,
  };
}

// Removing something that is not there is a no-op, so a double tap or a stale
// screen cannot turn into an error the user has to understand.
export function removeWatched(
  items: readonly WatchedToken[],
  id: WatchedAssetId,
): WatchedToken[] {
  const key = watchKey(id);

  return items.filter((item) => watchKey(item) !== key);
}

// Deterministic default order: most recently added first. Risk-based ordering is
// deliberately NOT the default — it would have to decide where "unknown" goes,
// and any answer that puts unknown below low silently buries the tokens we know
// least about.
export function sortWatchlist(items: readonly WatchedToken[]): WatchedToken[] {
  return [...items].sort((a, b) => {
    if (a.addedAt !== b.addedAt) {
      return b.addedAt - a.addedAt;
    }

    // Stable tiebreak so the list never reshuffles between renders.
    return watchKey(a).localeCompare(watchKey(b));
  });
}

// An entry saved for another network cannot be described by this build: the
// balances, token metadata and provider coverage all belong to the active
// network. Enriching it anyway would put one network's verdict on another
// network's token, so the entry is kept and simply left unchecked.
export function canEnrichOnNetwork(
  token: WatchedAssetId,
  activeChainId: number,
): boolean {
  return token.chainId === activeChainId;
}

// Local search over what is already loaded. Membership identity stays the
// address, so a token whose metadata never arrived is still findable by typing
// its address.
export function searchWatchlist(
  items: readonly WatchedToken[],
  query: string,
  describe: (id: WatchedAssetId) => { symbol?: string; name?: string },
): WatchedToken[] {
  const needle = query.trim().toLowerCase();

  if (!needle) {
    return [...items];
  }

  return items.filter((item) => {
    if (item.address.toLowerCase().includes(needle)) {
      return true;
    }

    const meta = describe(item);

    return (
      (meta.symbol?.toLowerCase().includes(needle) ?? false) ||
      (meta.name?.toLowerCase().includes(needle) ?? false)
    );
  });
}
