import type { ProviderId } from "@/core/token-intelligence/types";

export const TOKEN_INTELLIGENCE_NETWORK_SUPPORT = {
  1: {
    goplus: true,
    "honeypot-check": true,
    "honeypot-top-holders": true,
  },
  11155111: {
    goplus: false,
    "honeypot-check": false,
    "honeypot-top-holders": false,
  },
} as const satisfies Record<number, Record<ProviderId, boolean>>;

export function isTokenIntelligenceProviderSupported(
  chainId: number,
  provider: ProviderId,
): boolean {
  if (chainId === 1 || chainId === 11155111) {
    return TOKEN_INTELLIGENCE_NETWORK_SUPPORT[chainId][provider];
  }

  return false;
}

export function unsupportedProviderReason(chainId: number): string {
  return chainId === 11155111
    ? "Token Intelligence is unavailable on Ethereum Sepolia"
    : `Token Intelligence is unavailable on chain ${chainId}`;
}
