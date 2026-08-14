import { truncateAddress } from "@/core/blockchain/addressFingerprint";

import { BURN_ADDRESSES, HOLDER_RISK_THRESHOLDS } from "./constants";
import { evidenceConflict, resolveEvidence, unknownEvidence } from "./evidence";
import { reason, resultFromReasons } from "./risk";
import {
  UNKNOWN,
  type BalanceValue,
  type DomainMetric,
  type Evidence,
  type EvidenceConflict,
  type EvidenceObservation,
  type HolderCategory,
  type HolderDistribution,
  type HolderRecord,
  type MetricQuality,
  type NormalizedGoPlusHolder,
  type NormalizedGoPlusSnapshot,
  type NormalizedHoneypotHolder,
  type NormalizedHoneypotSnapshot,
  type NormalizedHoneypotTopHoldersSnapshot,
  type NormalizedLockDetail,
  type NumberValue,
  type ProviderId,
  type ProviderSnapshot,
  type RiskReason,
  type TokenAmount,
  type TriState,
} from "./types";
import {
  addBalances,
  asCount,
  asPercent,
  asTriState,
  amountToDecimalString,
  percentOf,
  subtractBalance,
  unique,
} from "./validation";

type HolderPair = {
  address: string;
  goplus: NormalizedGoPlusHolder | null;
  honeypot: NormalizedHoneypotHolder | null;
};

function withDecimals(value: BalanceValue, decimals: NumberValue): BalanceValue {
  if (value === UNKNOWN || value.decimals !== UNKNOWN || decimals === UNKNOWN) {
    return value;
  }

  return {
    units: value.units,
    decimals,
  };
}

function amountEquals(left: TokenAmount, right: TokenAmount): TriState {
  const leftText = amountToDecimalString(left);
  const rightText = amountToDecimalString(right);

  if (leftText !== UNKNOWN && rightText !== UNKNOWN) {
    return leftText === rightText;
  }

  if (left.decimals !== right.decimals) {
    return UNKNOWN;
  }

  return left.units === right.units;
}

function amountEvidence(
  observations: readonly EvidenceObservation<TokenAmount>[],
): Evidence<TokenAmount> {
  const known = observations.filter(
    (item): item is EvidenceObservation<TokenAmount> & { value: TokenAmount } =>
      item.value !== UNKNOWN,
  );

  if (known.length === 0) {
    return {
      ...unknownEvidence<TokenAmount>(),
      observations,
    };
  }

  const preferred =
    known.find((item) => item.source === "honeypot-top-holders") ?? known[0];
  const comparisons = known.map((item) =>
    amountEquals(item.value, preferred.value),
  );
  const conflict = comparisons.includes(false);
  const incomparable = comparisons.includes(UNKNOWN);

  return {
    value: preferred.value,
    observations,
    conflict,
    resolution:
      known.length === 1
        ? "single-source"
        : conflict || incomparable
          ? "preferred-source"
          : "consensus",
  };
}

function percentEvidence(
  observations: readonly EvidenceObservation<number>[],
): Evidence<number> {
  const sanitized = observations.map((item) => ({
    ...item,
    value: asPercent(item.value),
  }));
  const known = sanitized.filter(
    (item): item is EvidenceObservation<number> & { value: number } =>
      item.value !== UNKNOWN,
  );

  if (known.length === 0) {
    return {
      ...unknownEvidence<number>(),
      observations: sanitized,
    };
  }

  const preferred =
    known.find((item) => item.source === "honeypot-top-holders") ?? known[0];
  const conflict = known.some(
    (item) => Math.abs(item.value - preferred.value) > 0.05,
  );

  return {
    value: preferred.value,
    observations: sanitized,
    conflict,
    resolution:
      known.length === 1
        ? "single-source"
        : conflict
          ? "preferred-source"
          : "consensus",
  };
}

function booleanEvidence(
  observations: readonly EvidenceObservation<boolean>[],
): Evidence<boolean> {
  return resolveEvidence(
    observations.map((item) => ({
      ...item,
      value: asTriState(item.value),
    })),
    {
    conservative(values) {
      return values.includes(true) ? true : false;
    },
    },
  );
}

function mergePairs(
  goplus: readonly NormalizedGoPlusHolder[],
  honeypot: readonly NormalizedHoneypotHolder[],
): HolderPair[] {
  const byAddress = new Map<string, HolderPair>();

  for (const holder of honeypot) {
    const key = holder.address.toLowerCase();
    const current = byAddress.get(key);

    byAddress.set(key, {
      address: key,
      goplus: current?.goplus ?? null,
      honeypot: current?.honeypot ?? holder,
    });
  }

  for (const holder of goplus) {
    const key = holder.address.toLowerCase();
    const current = byAddress.get(key);

    byAddress.set(key, {
      address: key,
      goplus: current?.goplus ?? holder,
      honeypot: current?.honeypot ?? null,
    });
  }

  return [...byAddress.values()];
}

function displayText(value: string | typeof UNKNOWN): string | null {
  return value === UNKNOWN ? null : value;
}

function includesAny(value: string, words: readonly string[]): boolean {
  const normalized = value.toLowerCase();

  return words.some((word) => normalized.includes(word));
}

function categoryFor({
  address,
  tag,
  alias,
  isContract,
  lockReported,
  ownerAddress,
  creatorAddress,
  poolAddresses,
}: {
  address: string;
  tag: string | null;
  alias: string | null;
  isContract: TriState;
  lockReported: TriState;
  ownerAddress: string | null;
  creatorAddress: string | null;
  poolAddresses: ReadonlySet<string>;
}): HolderCategory {
  const label = `${tag ?? ""} ${alias ?? ""}`.trim();

  if (
    BURN_ADDRESSES.has(address) ||
    includesAny(label, ["burn address", "dead address", "null address"])
  ) {
    return "burn";
  }

  if (
    poolAddresses.has(address) ||
    includesAny(label, ["uniswap", "sushiswap", "pancake", "liquidity pool", "dex pair"])
  ) {
    return "liquidity_pool";
  }

  if (
    address === creatorAddress ||
    includesAny(label, ["deployer", "creator"])
  ) {
    return "deployer";
  }

  if (address === ownerAddress || includesAny(label, ["contract owner"])) {
    return "owner";
  }

  if (lockReported === true) {
    return "locked";
  }

  if (isContract === true) {
    return label ? "contract" : "unknown_contract";
  }

  return "wallet";
}

function labelFor(
  category: HolderCategory,
  address: string,
  tag: string | null,
  alias: string | null,
): string {
  if (tag) {
    return tag;
  }

  if (alias) {
    return alias;
  }

  if (category === "burn") {
    return "Burn Address";
  }

  if (category === "liquidity_pool") {
    return "Liquidity Pool";
  }

  if (category === "deployer") {
    return "Deployer";
  }

  if (category === "owner") {
    return "Owner";
  }

  return truncateAddress(address);
}

function zeroLike(value: BalanceValue): BalanceValue {
  return value === UNKNOWN
    ? UNKNOWN
    : { units: 0n, decimals: value.decimals };
}

function subtractPercent(
  rawPercent: NumberValue,
  rawBalance: BalanceValue,
  lockedBalance: BalanceValue,
): NumberValue {
  if (
    rawPercent === UNKNOWN ||
    rawBalance === UNKNOWN ||
    lockedBalance === UNKNOWN
  ) {
    return rawPercent;
  }

  const lockedShare = percentOf(lockedBalance, rawBalance);

  if (lockedShare === UNKNOWN) {
    return rawPercent;
  }

  return Math.max(0, rawPercent - (rawPercent * lockedShare) / 100);
}

function sumPercent(values: readonly NumberValue[]): NumberValue {
  if (values.length === 0) {
    return UNKNOWN;
  }

  const sanitized = values.map(asPercent);

  if (sanitized.some((value) => value === UNKNOWN)) {
    return UNKNOWN;
  }

  return Math.min(
    100,
    (sanitized as number[]).reduce((sum, value) => sum + value, 0),
  );
}

function hasTopCoverage({
  candidateCount,
  limit,
  returnedCount,
  totalHolders,
}: {
  candidateCount: number;
  limit: number;
  returnedCount: number;
  totalHolders: NumberValue;
}) {
  return (
    candidateCount >= limit ||
    (totalHolders !== UNKNOWN && returnedCount >= totalHolders)
  );
}

function metric<T>(
  value: T | typeof UNKNOWN,
  quality: MetricQuality,
  sources: readonly ProviderId[],
): DomainMetric<T> {
  return {
    value,
    quality: value === UNKNOWN ? "unknown" : quality,
    sources: unique(sources),
  };
}

function thresholdReason(
  reasons: RiskReason[],
  value: NumberValue,
  code: string,
  label: string,
  thresholds: { medium: number; high: number },
  sources: readonly ProviderId[],
) {
  if (value === UNKNOWN) {
    return;
  }

  if (value >= thresholds.high) {
    reasons.push(
      reason(code, "high", `${label} is ${value.toFixed(1)}%`, sources),
    );
  } else if (value >= thresholds.medium) {
    reasons.push(
      reason(code, "medium", `${label} is ${value.toFixed(1)}%`, sources),
    );
  }
}

export function buildHolderDistribution({
  goplus,
  honeypotCheck,
  honeypotTopHolders,
  now,
}: {
  goplus: ProviderSnapshot<NormalizedGoPlusSnapshot>;
  honeypotCheck: ProviderSnapshot<NormalizedHoneypotSnapshot>;
  honeypotTopHolders: ProviderSnapshot<NormalizedHoneypotTopHoldersSnapshot>;
  now: number;
}): HolderDistribution {
  const go = goplus.status === "available" ? goplus.data : null;
  const hp = honeypotCheck.status === "available" ? honeypotCheck.data : null;
  const top =
    honeypotTopHolders.status === "available"
      ? honeypotTopHolders.data
      : null;
  const hpDecimals = hp?.token.decimals ?? UNKNOWN;
  const topSupply = withDecimals(top?.totalSupply ?? UNKNOWN, hpDecimals);
  const totalSupplyObservations: EvidenceObservation<TokenAmount>[] = [];

  if (honeypotTopHolders.status === "available") {
    totalSupplyObservations.push({
      source: "honeypot-top-holders",
      value: topSupply,
      observedAt: honeypotTopHolders.observedAt,
    });
  }

  if (goplus.status === "available") {
    totalSupplyObservations.push({
      source: "goplus",
      value: go?.holders.totalSupply ?? UNKNOWN,
      observedAt: goplus.observedAt,
    });
  }

  const totalSupplyEvidence = amountEvidence(totalSupplyObservations);
  const totalSupply = totalSupplyEvidence.value;
  const poolAddresses = new Set<string>();

  for (const pool of [...(go?.liquidity.pools ?? []), ...(hp?.pairs ?? [])]) {
    if (pool.address !== UNKNOWN && /^0x[0-9a-f]{40}$/.test(pool.address)) {
      poolAddresses.add(pool.address.toLowerCase());
    }
  }

  const ownerAddress =
    go && go.contract.ownerAddress !== UNKNOWN && go.contract.ownerAddress !== "none"
      ? go.contract.ownerAddress.toLowerCase()
      : null;
  const creatorAddress =
    go && go.holders.creatorAddress !== UNKNOWN
      ? go.holders.creatorAddress.toLowerCase()
      : null;
  const pairs = mergePairs(go?.holders.holders ?? [], top?.holders ?? []);
  const records = pairs.map((pair): HolderRecord => {
    const gp = pair.goplus;
    const hpHolder = pair.honeypot;
    const hpBalance = withDecimals(hpHolder?.balance ?? UNKNOWN, hpDecimals);
    const gpBalance = gp?.balance ?? UNKNOWN;
    const hpPercent = percentOf(hpBalance, topSupply);
    const rawBalanceObservations: EvidenceObservation<TokenAmount>[] = [];
    const rawPercentObservations: EvidenceObservation<number>[] = [];
    const contractObservations: EvidenceObservation<boolean>[] = [];
    const lockObservations: EvidenceObservation<boolean>[] = [];

    if (hpHolder && honeypotTopHolders.status === "available") {
      rawBalanceObservations.push({
        source: "honeypot-top-holders",
        value: hpBalance,
        observedAt: honeypotTopHolders.observedAt,
      });
      rawPercentObservations.push({
        source: "honeypot-top-holders",
        value: hpPercent,
        observedAt: honeypotTopHolders.observedAt,
      });
      contractObservations.push({
        source: "honeypot-top-holders",
        value: hpHolder.isContract,
        observedAt: honeypotTopHolders.observedAt,
      });
    }

    if (gp && goplus.status === "available") {
      rawBalanceObservations.push({
        source: "goplus",
        value: gpBalance,
        observedAt: goplus.observedAt,
      });
      rawPercentObservations.push({
        source: "goplus",
        value: gp.percent,
        observedAt: goplus.observedAt,
      });
      contractObservations.push({
        source: "goplus",
        value: gp.isContract,
        observedAt: goplus.observedAt,
      });
      lockObservations.push({
        source: "goplus",
        value: gp.isLocked,
        observedAt: goplus.observedAt,
      });
    }

    const rawBalanceEvidence = amountEvidence(rawBalanceObservations);
    const rawPercentEvidence = percentEvidence(rawPercentObservations);
    const isContractEvidence = booleanEvidence(contractObservations);
    const isLockedEvidence = booleanEvidence(lockObservations);
    let rawBalance = rawBalanceEvidence.value;

    if (
      rawBalance !== UNKNOWN &&
      rawBalance.decimals === UNKNOWN &&
      gpBalance !== UNKNOWN
    ) {
      rawBalance = gpBalance;
    }

    const activeLocks: NormalizedLockDetail[] = [];
    const expiredLocks: NormalizedLockDetail[] = [];

    for (const lock of gp?.lockedDetails ?? []) {
      if (lock.endTimeMs !== UNKNOWN && lock.endTimeMs > now) {
        activeLocks.push(lock);
      } else if (lock.endTimeMs !== UNKNOWN) {
        expiredLocks.push(lock);
      }
    }

    const knownActiveAmounts = activeLocks
      .map((lock) => lock.amount)
      .filter((amount) => amount !== UNKNOWN);
    const knownLockedBalance =
      knownActiveAmounts.length > 0
        ? addBalances(knownActiveAmounts)
        : zeroLike(rawBalance);
    const tag = displayText(gp?.tag ?? UNKNOWN);
    const alias = displayText(hpHolder?.alias ?? UNKNOWN);
    const lockReported = isLockedEvidence.value;
    const category = categoryFor({
      address: pair.address,
      tag,
      alias,
      isContract: isContractEvidence.value,
      lockReported,
      ownerAddress,
      creatorAddress,
      poolAddresses,
    });
    const excluded = category === "burn" || category === "liquidity_pool";
    const liquidBalance = excluded
      ? zeroLike(rawBalance)
      : knownLockedBalance === UNKNOWN
        ? rawBalance
        : (subtractBalance(rawBalance, knownLockedBalance) ?? rawBalance);
    const validRawPercent =
      totalSupply !== UNKNOWN && totalSupply.units === 0n
        ? UNKNOWN
        : rawPercentEvidence.value;
    const liquidPercent = excluded
      ? validRawPercent === UNKNOWN
        ? UNKNOWN
        : 0
      : subtractPercent(
          validRawPercent,
          rawBalance,
          knownLockedBalance,
        );
    const lockStatus =
      activeLocks.length > 0
        ? "active"
        : expiredLocks.length > 0
          ? "expired"
          : lockReported === true
            ? "reported-unquantified"
            : "none";

    return {
      address: pair.address,
      label: labelFor(category, pair.address, tag, alias),
      category,
      isContract: isContractEvidence.value,
      isLocked: isLockedEvidence.value,
      lockStatus,
      lockDetails: gp?.lockedDetails ?? [],
      rawBalance,
      rawPercent: validRawPercent,
      lockedBalance: knownLockedBalance,
      liquidBalance,
      liquidPercent,
      evidence: {
        rawBalance: rawBalanceEvidence,
        rawPercent: rawPercentEvidence,
        isContract: isContractEvidence,
        isLocked: isLockedEvidence,
      },
    };
  });

  records.sort((left, right) => {
    const a = left.rawPercent === UNKNOWN ? -1 : left.rawPercent;
    const b = right.rawPercent === UNKNOWN ? -1 : right.rawPercent;

    return b - a;
  });

  const liquidHolders = records
    .filter(
      (holder) =>
        holder.category !== "burn" &&
        holder.category !== "liquidity_pool" &&
        holder.liquidPercent !== 0,
    )
    .sort((left, right) => {
      const a = left.liquidPercent === UNKNOWN ? -1 : left.liquidPercent;
      const b = right.liquidPercent === UNKNOWN ? -1 : right.liquidPercent;

      return b - a;
    });
  const sourceQuality: MetricQuality =
    top && go ? "complete" : top || go ? "partial" : "unknown";
  const distributionSources: ProviderId[] = [
    ...(top ? (["honeypot-top-holders"] as const) : []),
    ...(go ? (["goplus"] as const) : []),
  ];
  const totalHolderObservations: EvidenceObservation<number>[] = [];

  if (honeypotCheck.status === "available") {
    totalHolderObservations.push({
      source: "honeypot-check",
      value: asCount(hp?.token.totalHolders),
      observedAt: honeypotCheck.observedAt,
    });
  }

  if (goplus.status === "available") {
    totalHolderObservations.push({
      source: "goplus",
      value: asCount(go?.holders.totalHolders),
      observedAt: goplus.observedAt,
    });
  }

  const totalHoldersEvidence = resolveEvidence(totalHolderObservations, {
    preferredSources: ["honeypot-check", "goplus"],
  });
  const totalHolders = totalHoldersEvidence.value;
  const hasUnknownRawPercent = records.some(
    (holder) => holder.rawPercent === UNKNOWN,
  );
  const hasUnknownLiquidPercent = liquidHolders.some(
    (holder) => holder.liquidPercent === UNKNOWN,
  );
  const hasRawTop10Coverage = hasTopCoverage({
    candidateCount: records.length,
    limit: 10,
    returnedCount: records.length,
    totalHolders,
  });
  const hasLiquidTop5Coverage = hasTopCoverage({
    candidateCount: liquidHolders.length,
    limit: 5,
    returnedCount: records.length,
    totalHolders,
  });
  const hasLiquidTop10Coverage = hasTopCoverage({
    candidateCount: liquidHolders.length,
    limit: 10,
    returnedCount: records.length,
    totalHolders,
  });
  const rawTop10Percent = hasUnknownRawPercent || !hasRawTop10Coverage
    ? UNKNOWN
    : sumPercent(records.slice(0, 10).map((holder) => holder.rawPercent));
  const largestLiquidHolderPercent = hasUnknownLiquidPercent
    ? UNKNOWN
    : (liquidHolders[0]?.liquidPercent ?? UNKNOWN);
  const top5LiquidPercent =
    hasUnknownLiquidPercent || !hasLiquidTop5Coverage
    ? UNKNOWN
    : sumPercent(
        liquidHolders.slice(0, 5).map((holder) => holder.liquidPercent),
      );
  const top10LiquidPercent =
    hasUnknownLiquidPercent || !hasLiquidTop10Coverage
    ? UNKNOWN
    : sumPercent(
        liquidHolders.slice(0, 10).map((holder) => holder.liquidPercent),
      );
  const deployerPercent =
    go?.holders.creatorPercent ??
    records.find((holder) => holder.category === "deployer")?.rawPercent ??
    UNKNOWN;
  const ownerPercent =
    go?.holders.ownerPercent ??
    records.find((holder) => holder.category === "owner")?.rawPercent ??
    UNKNOWN;
  const burnPercent = sumPercent(
    records
      .filter((holder) => holder.category === "burn")
      .map((holder) => holder.rawPercent),
  );
  const liquidityPoolPercent = sumPercent(
    records
      .filter((holder) => holder.category === "liquidity_pool")
      .map((holder) => holder.rawPercent),
  );
  const knownLockedPercent = sumPercent(
    records.map((holder) => {
      if (
        holder.rawPercent === UNKNOWN ||
        holder.rawBalance === UNKNOWN ||
        holder.lockedBalance === UNKNOWN
      ) {
        return UNKNOWN;
      }

      const share = percentOf(holder.lockedBalance, holder.rawBalance);

      return share === UNKNOWN
        ? UNKNOWN
        : (holder.rawPercent * share) / 100;
    }),
  );
  const conflicts: EvidenceConflict[] = [];
  const addConflict = (conflict: EvidenceConflict | null) => {
    if (conflict) {
      conflicts.push(conflict);
    }
  };

  addConflict(evidenceConflict("Total token supply", totalSupplyEvidence));
  addConflict(evidenceConflict("Total holder count", totalHoldersEvidence));

  for (const holder of records) {
    addConflict(
      evidenceConflict(
        `Holder ${holder.address} raw balance`,
        holder.evidence.rawBalance,
      ),
    );
    addConflict(
      evidenceConflict(
        `Holder ${holder.address} raw share`,
        holder.evidence.rawPercent,
      ),
    );
    addConflict(
      evidenceConflict(
        `Holder ${holder.address} contract classification`,
        holder.evidence.isContract,
      ),
    );
  }

  const concentrationKnown =
    largestLiquidHolderPercent !== UNKNOWN &&
    top5LiquidPercent !== UNKNOWN &&
    top10LiquidPercent !== UNKNOWN;
  const distributionQuality: MetricQuality =
    sourceQuality === "unknown"
      ? "unknown"
      : sourceQuality === "complete" && concentrationKnown && conflicts.length === 0
        ? "complete"
        : "partial";
  const metricSources = distributionSources;
  const reasons: RiskReason[] = [];

  thresholdReason(
    reasons,
    largestLiquidHolderPercent,
    "largest-liquid-holder",
    "Largest liquid holder",
    HOLDER_RISK_THRESHOLDS.largestLiquidHolderPercent,
    metricSources,
  );
  thresholdReason(
    reasons,
    top10LiquidPercent,
    "top10-liquid-holders",
    "Top 10 liquid holders",
    HOLDER_RISK_THRESHOLDS.top10LiquidPercent,
    metricSources,
  );
  thresholdReason(
    reasons,
    deployerPercent,
    "deployer-concentration",
    "Deployer balance",
    HOLDER_RISK_THRESHOLDS.deployerPercent,
    metricSources,
  );

  if (sourceQuality === "partial") {
    reasons.push(
      reason(
        "holder-data-partial",
        "info",
        "Holder distribution is based on partial provider coverage",
        metricSources,
      ),
    );
  }

  const risk = resultFromReasons({
    reasons,
    confidence:
      distributionQuality === "complete"
        ? "full"
        : distributionQuality === "partial"
          ? "partial"
          : "unknown",
    lowWhenClear: distributionQuality === "complete" && concentrationKnown,
  });
  const availableCount = [goplus, honeypotTopHolders].filter(
    (snapshot) => snapshot.status === "available",
  ).length;
  const allUnsupported = [goplus, honeypotTopHolders].every(
    (snapshot) => snapshot.status === "unsupported",
  );
  const anyLoading = [goplus, honeypotTopHolders].some(
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
    quality: distributionQuality,
    totalSupply: metric(
      totalSupply,
      totalSupplyEvidence.conflict ? "partial" : sourceQuality,
      distributionSources,
    ),
    metrics: {
      totalHolders: metric(
        totalHolders,
        totalHoldersEvidence.conflict
          ? "partial"
          : totalHolderObservations.length > 1
            ? "complete"
            : sourceQuality,
        totalHolderObservations.map((item) => item.source),
      ),
      rawTop10Percent: metric(
        rawTop10Percent,
        distributionQuality,
        metricSources,
      ),
      largestLiquidHolderPercent: metric(
        largestLiquidHolderPercent,
        distributionQuality,
        metricSources,
      ),
      top5LiquidPercent: metric(
        top5LiquidPercent,
        distributionQuality,
        metricSources,
      ),
      top10LiquidPercent: metric(
        top10LiquidPercent,
        distributionQuality,
        metricSources,
      ),
      deployerPercent: metric(deployerPercent, sourceQuality, ["goplus"]),
      ownerPercent: metric(ownerPercent, sourceQuality, ["goplus"]),
      burnPercent: metric(burnPercent, distributionQuality, metricSources),
      liquidityPoolPercent: metric(
        liquidityPoolPercent,
        distributionQuality,
        metricSources,
      ),
      knownLockedPercent: metric(
        knownLockedPercent,
        sourceQuality,
        ["goplus"],
      ),
    },
    holders: records,
    liquidHolders,
    conflicts,
    risk,
  };
}
