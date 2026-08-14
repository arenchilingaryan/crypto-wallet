import type { ProviderId } from "@/core/token-intelligence/types";

import { TOKEN_INTELLIGENCE_REQUEST_TIMEOUT_MS } from "./cache";
import { TokenIntelligenceProviderError } from "./errors";

const MAX_RESPONSE_BYTES = 2_000_000;

const RESPONSE_TOO_LARGE = Symbol("response-too-large");

async function readBoundedBody(response: Response): Promise<string> {
  const reader = response.body?.getReader?.();

  if (!reader) {
    // No streaming API (React Native's fetch). We cannot cut the body off
    // mid-download, so the only safe bound is a declared, finite length within
    // the ceiling. A response that will not say how large it is — a missing
    // header reads as `Number(null) === 0`, which would otherwise sail through
    // — is refused rather than buffered blind, since a fixed provider that
    // normally declares its length omitting it is exactly the abuse case.
    const header = response.headers.get("content-length");

    const declared = Number(header);

    if (
      header === null ||
      !Number.isFinite(declared) ||
      declared <= 0 ||
      declared > MAX_RESPONSE_BYTES
    ) {
      throw RESPONSE_TOO_LARGE;
    }

    const text = await response.text();

    if (text.length > MAX_RESPONSE_BYTES) {
      throw RESPONSE_TOO_LARGE;
    }

    return text;
  }

  const decoder = new TextDecoder();

  let received = 0;

  let text = "";

  for (;;) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    received += value.byteLength;

    if (received > MAX_RESPONSE_BYTES) {
      await reader.cancel();

      throw RESPONSE_TOO_LARGE;
    }

    text += decoder.decode(value, { stream: true });
  }

  text += decoder.decode();

  return text;
}

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

    const declaredLength = Number(response.headers.get("content-length"));

    if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
      throw new TokenIntelligenceProviderError(
        "Security data provider returned an implausibly large response",
        provider,
        "invalid-response",
        response.status,
      );
    }

    let body: string;

    try {
      body = await readBoundedBody(response);
    } catch (error) {
      if (error === RESPONSE_TOO_LARGE) {
        throw new TokenIntelligenceProviderError(
          "Security data provider returned an implausibly large response",
          provider,
          "invalid-response",
          response.status,
        );
      }

      throw new TokenIntelligenceProviderError(
        "Security data provider could not be read",
        provider,
        "network",
        response.status,
      );
    }

    try {
      return JSON.parse(body);
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
