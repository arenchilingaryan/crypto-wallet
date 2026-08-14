import { LIQUIDITY_RISK_THRESHOLDS_USD } from "./constants";
import { reason, resultFromReasons } from "./risk";
import {
  UNKNOWN,
  type DomainMetric,
  type LiquidityIntelligence,
  type LiquidityPool,
  type MetricQuality,
  type NormalizedGoPlusSnapshot,
  type NormalizedHoneypotSnapshot,
  type ProviderId,
  type ProviderSnapshot,
  type RiskReason,
} from "./types";
import { asNonNegativeNumber, unique } from "./validation";

function poolKey(pool: LiquidityPool, index: number): string {
  return pool.address === UNKNOWN
    ? `${pool.source}:${index}`
    : pool.address.toLowerCase();
}

function sourcePools(
  source: ProviderId,
  observedAt: number,
  pools: NormalizedGoPlusSnapshot["liquidity"]["pools"],
): LiquidityPool[] {
  return pools.map((pool) => ({
    ...pool,
    liquidityUsd: asNonNegativeNumber(pool.liquidityUsd),
    source,
    observedAt,
  }));
}

function metric(
  value: number | typeof UNKNOWN,
  quality: MetricQuality,
  sources: readonly ProviderId[],
): DomainMetric<number> {
  return {
    value,
    quality: value === UNKNOWN ? "unknown" : quality,
    sources: unique(sources),
  };
}

export function buildLiquidityIntelligence({
  goplus,
  honeypot,
}: {
  goplus: ProviderSnapshot<NormalizedGoPlusSnapshot>;
  honeypot: ProviderSnapshot<NormalizedHoneypotSnapshot>;
}): LiquidityIntelligence {
  const go = goplus.status === "available" ? goplus.data : null;
  const hp = honeypot.status === "available" ? honeypot.data : null;
  const goPools =
    go && goplus.status === "available"
      ? sourcePools("goplus", goplus.observedAt, go.liquidity.pools)
      : [];
  const hpPools =
    hp && honeypot.status === "available"
      ? sourcePools("honeypot-check", honeypot.observedAt, hp.pairs)
      : [];
  const merged = new Map<string, LiquidityPool>();

  for (const [index, pool] of [...goPools, ...hpPools].entries()) {
    const key = poolKey(pool, index);
    const current = merged.get(key);

    if (!current || pool.source === "honeypot-check") {
      merged.set(key, pool);
    }
  }

  const pools = [...merged.values()].sort((left, right) => {
    const a = left.liquidityUsd === UNKNOWN ? -1 : left.liquidityUsd;
    const b = right.liquidityUsd === UNKNOWN ? -1 : right.liquidityUsd;

    return b - a;
  });
  const knownLiquidity = pools
    .map((pool) => pool.liquidityUsd)
    .filter((value): value is number => value !== UNKNOWN);
  const explicitlyNotInDex = go?.trading.isInDex === false;
  const detectedLiquidity =
    knownLiquidity.length > 0
      ? knownLiquidity.reduce((sum, value) => sum + value, 0)
      : explicitlyNotInDex
        ? 0
        : UNKNOWN;
  const totalLiquidityUsd =
    detectedLiquidity === UNKNOWN
      ? UNKNOWN
      : asNonNegativeNumber(detectedLiquidity);
  const availableCount = [goplus, honeypot].filter(
    (snapshot) => snapshot.status === "available",
  ).length;
  const quality: MetricQuality =
    availableCount === 2 ? "complete" : availableCount === 1 ? "partial" : "unknown";
  const sources = pools.map((pool) => pool.source);
  const reasons: RiskReason[] = [];

  if (totalLiquidityUsd !== UNKNOWN) {
    if (totalLiquidityUsd < LIQUIDITY_RISK_THRESHOLDS_USD.highBelow) {
      reasons.push(
        reason(
          "low-liquidity",
          "high",
          `Detected liquidity is $${Math.round(totalLiquidityUsd).toLocaleString("en-US")}`,
          sources.length > 0 ? sources : ["goplus"],
        ),
      );
    } else if (
      totalLiquidityUsd <= LIQUIDITY_RISK_THRESHOLDS_USD.mediumAtOrBelow
    ) {
      reasons.push(
        reason(
          "moderate-liquidity",
          "medium",
          `Detected liquidity is $${Math.round(totalLiquidityUsd).toLocaleString("en-US")}`,
          sources,
        ),
      );
    }
  }

  if (explicitlyNotInDex) {
    reasons.push(
      reason("not-in-dex", "high", "No supported DEX market was detected", ["goplus"]),
    );
  }

  const risk = resultFromReasons({
    reasons,
    confidence:
      quality === "complete" ? "full" : quality === "partial" ? "partial" : "unknown",
    lowWhenClear:
      totalLiquidityUsd !== UNKNOWN &&
      totalLiquidityUsd > LIQUIDITY_RISK_THRESHOLDS_USD.mediumAtOrBelow,
  });
  const allUnsupported = [goplus, honeypot].every(
    (snapshot) => snapshot.status === "unsupported",
  );
  const anyLoading = [goplus, honeypot].some(
    (snapshot) => snapshot.status === "loading",
  );
  const availability = allUnsupported
    ? "unsupported"
    : availableCount === 2
      ? "available"
      : availableCount === 1
        ? "partial"
        : anyLoading
          ? "loading"
          : "unavailable";

  return {
    availability,
    totalLiquidityUsd: metric(totalLiquidityUsd, quality, sources),
    pools,
    risk,
  };
}
