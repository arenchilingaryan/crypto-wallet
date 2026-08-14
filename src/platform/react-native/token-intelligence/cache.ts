import { TOKEN_INTELLIGENCE_CACHE_POLICY_MS } from "@/core/token-intelligence/constants";
import type { ProviderId } from "@/core/token-intelligence/types";

export const TOKEN_INTELLIGENCE_ENDPOINT_CACHE_TTL_MS = {
  // GoPlus returns trade, liquidity, holder and contract facts in one payload.
  // The shortest affected facet controls the raw endpoint cache lifetime.
  goplus: TOKEN_INTELLIGENCE_CACHE_POLICY_MS.trade,
  "honeypot-check": TOKEN_INTELLIGENCE_CACHE_POLICY_MS.trade,
  "honeypot-top-holders": TOKEN_INTELLIGENCE_CACHE_POLICY_MS.holders,
} as const satisfies Record<ProviderId, number>;

export const TOKEN_INTELLIGENCE_REQUEST_TIMEOUT_MS = 12_000;

type CacheValue<T> = {
  value: T;

  expiresAt: number;
};

export type CachedRequestResult<T> = {
  value: T;

  fromCache: boolean;
};

export class TokenIntelligenceRequestCache<T> {
  private readonly values = new Map<string, CacheValue<T>>();

  private readonly inFlight = new Map<string, Promise<T>>();

  async getOrLoad({
    key,
    ttlMs,
    forceRefresh,
    now,
    load,
  }: {
    key: string;

    ttlMs: number;

    forceRefresh: boolean;

    now: () => number;

    load: () => Promise<T>;
  }): Promise<CachedRequestResult<T>> {
    const currentTime = now();

    const cached = this.values.get(key);

    if (!forceRefresh && cached && cached.expiresAt > currentTime) {
      return {
        value: cached.value,
        fromCache: true,
      };
    }

    if (cached) {
      this.values.delete(key);
    }

    const pending = this.inFlight.get(key);

    if (pending) {
      return {
        value: await pending,
        fromCache: false,
      };
    }

    const request = load();

    this.inFlight.set(key, request);

    try {
      const value = await request;

      this.values.set(key, {
        value,
        expiresAt: now() + ttlMs,
      });

      return {
        value,
        fromCache: false,
      };
    } finally {
      if (this.inFlight.get(key) === request) {
        this.inFlight.delete(key);
      }
    }
  }

  clear(): void {
    this.values.clear();
  }
}
