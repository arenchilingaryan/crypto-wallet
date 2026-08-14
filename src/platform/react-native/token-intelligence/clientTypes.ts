import type { ProviderSnapshot } from "@/core/token-intelligence/types";

import type { CachedRequestResult } from "./cache";
import type { TokenIntelligenceFetch } from "./http";

export type TimedProviderData<T> = Extract<
  ProviderSnapshot<T>,
  { status: "available" }
>;

export type ProviderClientResult<T> = CachedRequestResult<TimedProviderData<T>>;

export type ProviderClientOptions = {
  chainId: number;

  tokenAddress: string;

  forceRefresh?: boolean;

  fetcher?: TokenIntelligenceFetch;

  signal?: AbortSignal;

  now?: () => number;
};
