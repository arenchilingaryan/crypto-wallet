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

// "Not supported here" is not "we tried and could not reach it". The wallet
// keeps those two apart everywhere else, so the wording must keep them apart
// too: retrying fixes one and can never fix the other.
export function unsupportedProviderReason(chainId: number): string {
  return chainId === 11155111
    ? "Token Intelligence does not cover Ethereum Sepolia"
    : `Token Intelligence does not cover chain ${chainId}`;
}
