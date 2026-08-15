import type { Address } from "viem";

import type { WatchedToken, WatchlistSnapshot } from "./types";
import {
  isValidWatchedAssetId,
  MAX_WATCHLIST_ITEMS,
  sortWatchlist,
  watchKey,
} from "./watchlist";

export const WATCHLIST_STORAGE_VERSION = 1;

// The wallet account is deliberately absent from this key. The watchlist is a
// property of the person using the app, not of whichever account happens to be
// selected, so switching accounts must not change what is being watched.
export const WATCHLIST_STORAGE_KEY = "watchlist.v1";

type StoredShape = {
  version?: unknown;

  items?: unknown;
};

function unreadable(reason: string): WatchlistSnapshot {
  return { status: "unreadable", reason };
}

// Parsing rules, fixed deliberately rather than left to chance:
//   - absent store            → an empty, readable watchlist (nothing was saved)
//   - invalid JSON            → unreadable (never an empty-list lie)
//   - version we do not know  → unreadable (a newer app may have written richer
//                               data; silently downgrading it would destroy it)
//   - duplicate entries       → deduped, flagged as repaired
//   - malformed entry         → dropped, flagged as repaired
//   - more than the cap       → the newest MAX kept, flagged as repaired
export function parseWatchlist(raw: string | null): WatchlistSnapshot {
  if (raw === null) {
    return { status: "ready", items: [], repaired: false };
  }

  let parsed: StoredShape;

  try {
    parsed = JSON.parse(raw) as StoredShape;
  } catch {
    return unreadable("The saved watchlist could not be read.");
  }

  if (!parsed || typeof parsed !== "object") {
    return unreadable("The saved watchlist is not in a recognised format.");
  }

  if (parsed.version !== WATCHLIST_STORAGE_VERSION) {
    return unreadable(
      "The saved watchlist was written by a different version of this app.",
    );
  }

  if (!Array.isArray(parsed.items)) {
    return unreadable("The saved watchlist is missing its list of tokens.");
  }

  let repaired = false;

  const seen = new Set<string>();

  const items: WatchedToken[] = [];

  for (const entry of parsed.items) {
    if (!entry || typeof entry !== "object") {
      repaired = true;

      continue;
    }

    const candidate = entry as {
      chainId?: unknown;
      address?: unknown;
      addedAt?: unknown;
    };

    if (
      !isValidWatchedAssetId({
        chainId: candidate.chainId,
        address: candidate.address,
      })
    ) {
      repaired = true;

      continue;
    }

    const addedAtIsUsable =
      typeof candidate.addedAt === "number" &&
      Number.isFinite(candidate.addedAt);

    if (!addedAtIsUsable) {
      // The substituted timestamp decides ordering and, past the cap, which
      // entries survive — so replacing it is a repair and must be reported as
      // one rather than passing for a faithful read.
      repaired = true;
    }

    const token: WatchedToken = {
      chainId: candidate.chainId as number,

      address: (candidate.address as string).toLowerCase() as Address,

      addedAt: addedAtIsUsable ? (candidate.addedAt as number) : 0,
    };

    const key = watchKey(token);

    if (seen.has(key)) {
      repaired = true;

      continue;
    }

    seen.add(key);

    items.push(token);
  }

  if (items.length > MAX_WATCHLIST_ITEMS) {
    return {
      status: "ready",

      items: sortWatchlist(items).slice(0, MAX_WATCHLIST_ITEMS),

      repaired: true,
    };
  }

  return { status: "ready", items, repaired };
}

export function serializeWatchlist(items: readonly WatchedToken[]): string {
  return JSON.stringify({
    version: WATCHLIST_STORAGE_VERSION,

    items: items.map((item) => ({
      chainId: item.chainId,

      address: item.address.toLowerCase(),

      addedAt: item.addedAt,
    })),
  });
}
