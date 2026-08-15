import type { Address } from "viem";

// The ONLY identity of a watched asset. Never a symbol, name, logo, provider id
// or array index: two different contracts routinely share a symbol (that is how
// impersonation works), and the same address on another chain is a different
// token. Everything else about a token is a mutable observation.
export type WatchedAssetId = {
  chainId: number;

  address: Address;
};

// The persistent truth is only "the user watches this (chain, address)" plus
// when they said so. Symbol, price, risk and liquidity are observations that
// change without the user doing anything, so they are never stored here as
// authoritative state.
export type WatchedToken = WatchedAssetId & {
  addedAt: number;
};

// A corrupt or future-version store must never be presented as "your watchlist
// is empty" — that reads as data loss the user caused. It is reported as
// unreadable so the UI can offer a retry instead of an empty-state lie.
export type WatchlistSnapshot =
  | {
      status: "ready";

      items: WatchedToken[];

      // True when the stored blob was structurally valid but had to be cleaned
      // up (duplicates, malformed entries, over the cap). The membership shown
      // is usable, but it is not byte-identical to what was on disk.
      repaired: boolean;
    }
  | {
      status: "unreadable";

      reason: string;
    };

export type WatchlistAddResult =
  | { ok: true; items: WatchedToken[]; alreadyWatched: boolean }
  | { ok: false; reason: "limit-reached" | "invalid-asset" };
