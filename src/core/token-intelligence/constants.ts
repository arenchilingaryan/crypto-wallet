export const HOLDER_RISK_THRESHOLDS = {
  largestLiquidHolderPercent: {
    medium: 10,
    high: 20,
  },
  top10LiquidPercent: {
    medium: 30,
    high: 50,
  },
  deployerPercent: {
    medium: 5,
    high: 10,
  },
} as const;

export const LIQUIDITY_RISK_THRESHOLDS_USD = {
  highBelow: 50_000,
  mediumAtOrBelow: 250_000,
} as const;

export const TRADE_TAX_RISK_THRESHOLDS_PERCENT = {
  medium: 5,
  high: 20,
} as const;

export const TOKEN_INTELLIGENCE_TAX_CONFLICT_TOLERANCE_PERCENT = 0.05;

export const TOKEN_INTELLIGENCE_CACHE_POLICY_MS = {
  trade: 45_000,
  liquidity: 45_000,
  holders: 3 * 60_000,
  contract: 10 * 60_000,
} as const;

export type TokenIntelligenceFacet =
  keyof typeof TOKEN_INTELLIGENCE_CACHE_POLICY_MS;

export const BURN_ADDRESSES = new Set([
  "0x0000000000000000000000000000000000000000",
  "0x000000000000000000000000000000000000dead",
]);
