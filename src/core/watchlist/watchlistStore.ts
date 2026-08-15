import type { KeyValueStorage } from "@/core/ports/keyValueStorage";

import {
  parseWatchlist,
  serializeWatchlist,
  WATCHLIST_STORAGE_KEY,
} from "./storage";
import type {
  WatchedAssetId,
  WatchedToken,
  WatchlistSnapshot,
} from "./types";
import { addWatched, isWatched, removeWatched } from "./watchlist";

export type WatchlistMutation =
  | { ok: true; items: WatchedToken[] }
  | {
      ok: false;
      reason: "limit-reached" | "invalid-asset" | "unreadable" | "write-failed";
      message: string;
    };

// Three answers, not two. "We could not read the list" is not "you are not
// watching this" — collapsing it would put a confident empty star on a token
// the user is in fact watching.
export type WatchStatus = "watching" | "not-watching" | "unreadable";

export type WatchlistStore = {
  load(): Promise<WatchlistSnapshot>;

  isWatched(id: WatchedAssetId): Promise<WatchStatus>;

  add(id: WatchedAssetId, addedAt?: number): Promise<WatchlistMutation>;

  remove(id: WatchedAssetId): Promise<WatchlistMutation>;
};

export function createWatchlistStore({
  storage,
  now = () => Date.now(),
}: {
  storage: KeyValueStorage;

  now?: () => number;
}): WatchlistStore {
  // Every mutation is appended to a single promise chain. Two taps that race —
  // "watch A" and "watch B" — would otherwise both read the same list, each add
  // their own token, and the second write would erase the first. Serialising the
  // read-modify-write is the whole fix; a journal would be more machinery than
  // this problem needs.
  let queue: Promise<unknown> = Promise.resolve();

  function serialized<T>(operation: () => Promise<T>): Promise<T> {
    const run = queue.then(operation, operation);

    // Keep the chain alive even when an operation rejects, so one failure cannot
    // wedge every later mutation.
    queue = run.then(
      () => undefined,
      () => undefined,
    );

    return run;
  }

  async function readSnapshot(): Promise<WatchlistSnapshot> {
    try {
      return parseWatchlist(await storage.get(WATCHLIST_STORAGE_KEY));
    } catch {
      return {
        status: "unreadable",
        reason: "The watchlist could not be read from this device.",
      };
    }
  }

  async function write(items: WatchedToken[]): Promise<WatchlistMutation> {
    try {
      await storage.set(WATCHLIST_STORAGE_KEY, serializeWatchlist(items));
    } catch {
      return {
        ok: false,
        reason: "write-failed",
        message: "The watchlist could not be saved on this device.",
      };
    }

    return { ok: true, items };
  }

  return {
    async load() {
      return serialized(readSnapshot);
    },

    async isWatched(id) {
      const snapshot = await serialized(readSnapshot);

      if (snapshot.status !== "ready") {
        return "unreadable";
      }

      return isWatched(snapshot.items, id) ? "watching" : "not-watching";
    },

    async add(id, addedAt) {
      return serialized(async () => {
        const snapshot = await readSnapshot();

        // Never overwrite a store we could not understand: that would turn a
        // recoverable read problem into permanent loss of the user's list.
        if (snapshot.status === "unreadable") {
          return {
            ok: false as const,
            reason: "unreadable" as const,
            message: snapshot.reason,
          };
        }

        const result = addWatched(snapshot.items, id, addedAt ?? now());

        if (!result.ok) {
          return result.reason === "invalid-asset"
            ? {
                ok: false as const,
                reason: "invalid-asset" as const,
                message: "That token could not be identified.",
              }
            : {
                ok: false as const,
                reason: "limit-reached" as const,
                message:
                  "Watchlist limit reached. Remove an asset before adding another.",
              };
        }

        if (result.alreadyWatched) {
          return { ok: true as const, items: result.items };
        }

        return write(result.items);
      });
    },

    async remove(id) {
      return serialized(async () => {
        const snapshot = await readSnapshot();

        if (snapshot.status === "unreadable") {
          return {
            ok: false as const,
            reason: "unreadable" as const,
            message: snapshot.reason,
          };
        }

        const items = removeWatched(snapshot.items, id);

        if (items.length === snapshot.items.length) {
          return { ok: true as const, items };
        }

        return write(items);
      });
    },
  };
}
