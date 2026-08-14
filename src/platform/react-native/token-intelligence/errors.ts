import {
  UNKNOWN,
  type KnownOrUnknown,
  type ProviderId,
} from "@/core/token-intelligence/types";

export type ProviderFailureKind =
  | "aborted"
  | "http"
  | "invalid-response"
  | "network"
  | "not-found"
  | "rate-limited"
  | "timeout";

export class TokenIntelligenceProviderError extends Error {
  constructor(
    message: string,
    readonly provider: ProviderId,
    readonly kind: ProviderFailureKind,
    readonly status: KnownOrUnknown<number> = UNKNOWN,
  ) {
    super(message);

    this.name = "TokenIntelligenceProviderError";
  }
}

export function providerFailureReason(
  error: unknown,
  fallback: string,
): string {
  if (error instanceof TokenIntelligenceProviderError) {
    return error.message;
  }

  return fallback;
}
