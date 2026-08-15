// Refreshing a watchlist means fanning out to several providers per token. Fifty
// watched tokens must therefore never become fifty simultaneous fan-outs: that
// is a self-inflicted rate-limit and a stalled UI. Work is processed in order
// with a fixed number of workers, and a failure on one item never stops the
// queue — the whole point is that one bad token cannot hide the other forty-nine.

export const MAX_REFRESH_CONCURRENCY = 4;

export async function runBounded<T>({
  items,
  limit = MAX_REFRESH_CONCURRENCY,
  worker,
  onSettled,
}: {
  items: readonly T[];

  limit?: number;

  worker: (item: T, index: number) => Promise<void>;

  // Called after each item finishes, successfully or not, so callers can track
  // progress without waiting for the whole queue.
  onSettled?: (item: T, index: number, error: unknown) => void;
}): Promise<void> {
  if (items.length === 0) {
    return;
  }

  // A non-finite limit would make the worker count NaN and quietly process
  // nothing while still resolving as success — a refresh that silently does not
  // happen is worse than a slow one.
  const requested = Number.isFinite(limit) ? limit : MAX_REFRESH_CONCURRENCY;

  const workers = Math.max(1, Math.min(requested, items.length));

  let next = 0;

  async function pump(): Promise<void> {
    for (;;) {
      const index = next;

      next += 1;

      if (index >= items.length) {
        return;
      }

      const item = items[index];

      let failure: unknown = null;

      try {
        await worker(item, index);
      } catch (error) {
        failure = error ?? new Error("Refresh failed");
      }

      onSettled?.(item, index, failure);
    }
  }

  await Promise.all(Array.from({ length: workers }, () => pump()));
}
