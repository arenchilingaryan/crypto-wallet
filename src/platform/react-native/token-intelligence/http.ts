import type { ProviderId } from "@/core/token-intelligence/types";

import { TOKEN_INTELLIGENCE_REQUEST_TIMEOUT_MS } from "./cache";
import { TokenIntelligenceProviderError } from "./errors";

export type TokenIntelligenceFetch = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.message === "Aborted")
  );
}

export async function requestProviderJson({
  url,
  provider,
  fetcher = fetch,
  signal,
  headers,
  timeoutMs = TOKEN_INTELLIGENCE_REQUEST_TIMEOUT_MS,
}: {
  url: string;

  provider: ProviderId;

  fetcher?: TokenIntelligenceFetch;

  signal?: AbortSignal;

  headers?: HeadersInit;

  timeoutMs?: number;
}): Promise<unknown> {
  const controller = new AbortController();

  let timedOut = false;

  const abortFromCaller = () => controller.abort();

  if (signal?.aborted) {
    controller.abort();
  } else {
    signal?.addEventListener("abort", abortFromCaller, { once: true });
  }

  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    let response: Response;

    try {
      response = await fetcher(url, {
        method: "GET",
        headers,
        signal: controller.signal,
      });
    } catch (error) {
      if (timedOut) {
        throw new TokenIntelligenceProviderError(
          "Security data request timed out",
          provider,
          "timeout",
        );
      }

      if (signal?.aborted || isAbortError(error)) {
        throw new TokenIntelligenceProviderError(
          "Security data request was cancelled",
          provider,
          "aborted",
        );
      }

      throw new TokenIntelligenceProviderError(
        "Security data provider could not be reached",
        provider,
        "network",
      );
    }

    if (!response.ok) {
      const kind =
        response.status === 404
          ? "not-found"
          : response.status === 429
            ? "rate-limited"
            : "http";

      throw new TokenIntelligenceProviderError(
        response.status === 429
          ? "Security data provider rate limit reached"
          : response.status === 404
            ? "Security data was not found for this token"
            : `Security data provider returned HTTP ${response.status}`,
        provider,
        kind,
        response.status,
      );
    }

    try {
      return await response.json();
    } catch {
      throw new TokenIntelligenceProviderError(
        "Security data provider returned invalid JSON",
        provider,
        "invalid-response",
        response.status,
      );
    }
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abortFromCaller);
  }
}
