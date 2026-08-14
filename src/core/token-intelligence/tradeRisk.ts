import {
  TOKEN_INTELLIGENCE_TAX_CONFLICT_TOLERANCE_PERCENT,
  TRADE_TAX_RISK_THRESHOLDS_PERCENT,
} from "./constants";
import {
  evidenceConflict,
  evidenceSources,
  resolveEvidence,
  unknownEvidence,
} from "./evidence";
import {
  honeypotFlagLevel,
  honeypotFlagMessage,
  honeypotFlagReasonCode,
  isContractHoneypotFlag,
} from "./honeypotFlags";
import { reason, resultFromReasons, uniqueReasons } from "./risk";
import {
  UNKNOWN,
  type Evidence,
  type EvidenceConflict,
  type EvidenceObservation,
  type NormalizedGoPlusSnapshot,
  type NormalizedHoneypotSnapshot,
  type ProviderSnapshot,
  type RiskReason,
  type SimulationFailureKind,
  type TradeIntelligence,
} from "./types";
import { asPercent, asTriState } from "./validation";

type TradeBuildResult = {
  trade: TradeIntelligence;
  conflicts: EvidenceConflict[];
};

function observation<T>(
  snapshot: ProviderSnapshot<unknown>,
  source: "goplus" | "honeypot-check",
  value: T | typeof UNKNOWN,
): EvidenceObservation<T> | null {
  return snapshot.status === "available"
    ? { source, value, observedAt: snapshot.observedAt }
    : null;
}

function booleanEvidence(
  observations: readonly (EvidenceObservation<boolean> | null)[],
): Evidence<boolean> {
  return resolveEvidence(
    observations
      .filter((item): item is EvidenceObservation<boolean> => item !== null)
      .map((item) => ({ ...item, value: asTriState(item.value) })),
    {
      conservative(values) {
        return values.includes(true) ? true : false;
      },
    },
  );
}

function percentEvidence(
  observations: readonly (EvidenceObservation<number> | null)[],
): Evidence<number> {
  const items = observations.filter(
    (item): item is EvidenceObservation<number> => item !== null,
  ).map((item) => ({ ...item, value: asPercent(item.value) }));
  const known = items.filter(
    (item): item is EvidenceObservation<number> & { value: number } =>
      item.value !== UNKNOWN,
  );

  if (known.length === 0) {
    return {
      ...unknownEvidence<number>(),
      observations: items,
    };
  }

  const minimum = Math.min(...known.map((item) => item.value));
  const maximum = Math.max(...known.map((item) => item.value));
  const conflict =
    maximum - minimum > TOKEN_INTELLIGENCE_TAX_CONFLICT_TOLERANCE_PERCENT;
  const preferred =
    known.find((item) => item.source === "honeypot-check") ?? known[0];

  return {
    value: preferred.value,
    observations: items,
    conflict,
    resolution:
      known.length === 1
        ? "single-source"
        : conflict
          ? "preferred-source"
          : "consensus",
  };
}

function singleEvidence<T>(
  item: EvidenceObservation<T> | null,
): Evidence<T> {
  return item ? resolveEvidence([item]) : unknownEvidence<T>();
}

function taxReason(
  kind: "buy" | "sell" | "transfer",
  evidence: Evidence<number>,
): RiskReason | null {
  if (evidence.value === UNKNOWN) {
    return null;
  }

  const value = evidence.value;
  const label = `${kind[0].toUpperCase()}${kind.slice(1)} tax is ${value.toFixed(2)}%`;

  if (value >= 99 && kind !== "transfer") {
    return reason(
      `${kind}-tax-critical`,
      "critical",
      label,
      evidenceSources(evidence),
    );
  }

  if (value >= TRADE_TAX_RISK_THRESHOLDS_PERCENT.high) {
    return reason(`${kind}-tax-high`, "high", label, evidenceSources(evidence));
  }

  if (value >= TRADE_TAX_RISK_THRESHOLDS_PERCENT.medium) {
    return reason(
      `${kind}-tax-medium`,
      "medium",
      label,
      evidenceSources(evidence),
    );
  }

  return null;
}

export function buildTradeIntelligence({
  goplus,
  honeypot,
}: {
  goplus: ProviderSnapshot<NormalizedGoPlusSnapshot>;
  honeypot: ProviderSnapshot<NormalizedHoneypotSnapshot>;
}): TradeBuildResult {
  const go = goplus.status === "available" ? goplus.data : null;
  const hp = honeypot.status === "available" ? honeypot.data : null;

  const simulationSuccess = singleEvidence(
    observation(
      honeypot,
      "honeypot-check",
      hp?.simulation.success ?? UNKNOWN,
    ),
  );
  const simulationError = singleEvidence(
    observation(
      honeypot,
      "honeypot-check",
      hp?.simulation.error ?? UNKNOWN,
    ),
  );
  const simulationFailureKind = singleEvidence<SimulationFailureKind>(
    observation(
      honeypot,
      "honeypot-check",
      hp?.simulation.failureKind ?? UNKNOWN,
    ),
  );
  const honeypotEvidence = booleanEvidence([
    observation(goplus, "goplus", go?.trading.isHoneypot ?? UNKNOWN),
    observation(honeypot, "honeypot-check", hp?.honeypot.isHoneypot ?? UNKNOWN),
  ]);
  const honeypotReason = singleEvidence(
    observation(
      honeypot,
      "honeypot-check",
      hp?.honeypot.reason ?? UNKNOWN,
    ),
  );
  const buyTaxPercent = percentEvidence([
    observation(goplus, "goplus", go?.trading.buyTaxPercent ?? UNKNOWN),
    observation(
      honeypot,
      "honeypot-check",
      hp?.simulationResult.buyTaxPercent ?? UNKNOWN,
    ),
  ]);
  const sellTaxPercent = percentEvidence([
    observation(goplus, "goplus", go?.trading.sellTaxPercent ?? UNKNOWN),
    observation(
      honeypot,
      "honeypot-check",
      hp?.simulationResult.sellTaxPercent ?? UNKNOWN,
    ),
  ]);
  const transferTaxPercent = percentEvidence([
    observation(goplus, "goplus", go?.trading.transferTaxPercent ?? UNKNOWN),
    observation(
      honeypot,
      "honeypot-check",
      hp?.simulationResult.transferTaxPercent ?? UNKNOWN,
    ),
  ]);
  const cannotBuy = booleanEvidence([
    observation(goplus, "goplus", go?.trading.cannotBuy ?? UNKNOWN),
  ]);
  const cannotSellAll = booleanEvidence([
    observation(goplus, "goplus", go?.trading.cannotSellAll ?? UNKNOWN),
  ]);
  const slippageModifiable = booleanEvidence([
    observation(goplus, "goplus", go?.trading.slippageModifiable ?? UNKNOWN),
  ]);
  const personalSlippageModifiable = booleanEvidence([
    observation(
      goplus,
      "goplus",
      go?.trading.personalSlippageModifiable ?? UNKNOWN,
    ),
  ]);
  const transferPausable = booleanEvidence([
    observation(goplus, "goplus", go?.trading.transferPausable ?? UNKNOWN),
  ]);
  const tradingCooldown = booleanEvidence([
    observation(goplus, "goplus", go?.trading.tradingCooldown ?? UNKNOWN),
  ]);
  const hasMaxBuyRestriction = booleanEvidence([
    observation(
      honeypot,
      "honeypot-check",
      hp?.simulationResult.hasMaxBuyRestriction ?? UNKNOWN,
    ),
  ]);
  const hasMaxSellRestriction = booleanEvidence([
    observation(
      honeypot,
      "honeypot-check",
      hp?.simulationResult.hasMaxSellRestriction ?? UNKNOWN,
    ),
  ]);
  const maxBuy = singleEvidence(
    observation(
      honeypot,
      "honeypot-check",
      hp?.simulationResult.maxBuy ?? UNKNOWN,
    ),
  );
  const maxSell = singleEvidence(
    observation(
      honeypot,
      "honeypot-check",
      hp?.simulationResult.maxSell ?? UNKNOWN,
    ),
  );

  const reasons: RiskReason[] = [];

  if (honeypotEvidence.value === true) {
    reasons.push(
      reason(
        honeypotEvidence.conflict ? "honeypot-conflict" : "honeypot-detected",
        "critical",
        honeypotEvidence.conflict
          ? "Providers disagree, and Honeypot simulation detected a honeypot"
          : honeypotReason.value === UNKNOWN
            ? "Honeypot behavior detected"
            : `Honeypot behavior detected: ${honeypotReason.value}`,
        evidenceSources(honeypotEvidence),
      ),
    );
  }

  if (
    simulationSuccess.value === false &&
    simulationFailureKind.value === "cannot-sell"
  ) {
    reasons.push(
      reason(
        "sell-simulation-failed",
        "critical",
        "Sell simulation failed; the token may not be sellable",
        evidenceSources(simulationSuccess),
      ),
    );
  } else if (
    simulationSuccess.value === false &&
    simulationFailureKind.value === "cannot-buy"
  ) {
    reasons.push(
      reason(
        "buy-simulation-failed",
        "high",
        "Buy simulation failed",
        evidenceSources(simulationSuccess),
      ),
    );
  } else if (simulationSuccess.value === false) {
    reasons.push(
      reason(
        "simulation-unavailable",
        "info",
        "Trade simulation did not complete; no risk level was inferred from the provider error",
        evidenceSources(simulationSuccess),
      ),
    );
  }

  if (cannotBuy.value === true) {
    reasons.push(
      reason("cannot-buy", "high", "The token currently cannot be bought", evidenceSources(cannotBuy)),
    );
  }

  if (cannotSellAll.value === true) {
    reasons.push(
      reason(
        "cannot-sell-all",
        "high",
        "The contract restricts selling the full balance",
        evidenceSources(cannotSellAll),
      ),
    );
  }

  for (const item of [
    taxReason("buy", buyTaxPercent),
    taxReason("sell", sellTaxPercent),
    taxReason("transfer", transferTaxPercent),
  ]) {
    if (item) {
      reasons.push(item);
    }
  }

  if (personalSlippageModifiable.value === true) {
    reasons.push(
      reason(
        "personal-tax-modifiable",
        "high",
        "Owner can set address-specific trading tax",
        evidenceSources(personalSlippageModifiable),
      ),
    );
  } else if (slippageModifiable.value === true) {
    reasons.push(
      reason(
        "tax-modifiable",
        "high",
        "Owner can modify trading tax",
        evidenceSources(slippageModifiable),
      ),
    );
  }

  if (transferPausable.value === true) {
    reasons.push(
      reason(
        "trading-pausable",
        "high",
        "Token transfers can be paused",
        evidenceSources(transferPausable),
      ),
    );
  }

  if (tradingCooldown.value === true) {
    reasons.push(
      reason(
        "trading-cooldown",
        "medium",
        "Trading cooldown detected",
        evidenceSources(tradingCooldown),
      ),
    );
  }

  if (hasMaxBuyRestriction.value === true) {
    reasons.push(
      reason(
        "max-buy",
        "medium",
        "Maximum buy restriction detected",
        evidenceSources(hasMaxBuyRestriction),
      ),
    );
  }

  if (hasMaxSellRestriction.value === true) {
    reasons.push(
      reason(
        "max-sell",
        "medium",
        "Maximum sell restriction detected",
        evidenceSources(hasMaxSellRestriction),
      ),
    );
  }

  if (go?.trading.isInDex === false) {
    reasons.push(
      reason("not-in-dex", "high", "No supported DEX market was detected", ["goplus"]),
    );
  }

  for (const [index, flag] of (hp?.summary.flags ?? []).entries()) {
    if (isContractHoneypotFlag(flag)) {
      continue;
    }

    reasons.push(
      reason(
        honeypotFlagReasonCode("trade", index, flag),
        honeypotFlagLevel(flag),
        honeypotFlagMessage(flag),
        ["honeypot-check"],
      ),
    );
  }

  const availableCount = [goplus, honeypot].filter(
    (item) => item.status === "available",
  ).length;
  const allWarningFactsKnown = [
    honeypotEvidence,
    buyTaxPercent,
    sellTaxPercent,
    transferTaxPercent,
    cannotBuy,
    cannotSellAll,
    slippageModifiable,
    personalSlippageModifiable,
    transferPausable,
    tradingCooldown,
    hasMaxBuyRestriction,
    hasMaxSellRestriction,
  ].every((item) => item.value !== UNKNOWN);
  const risk = resultFromReasons({
    reasons: uniqueReasons(reasons),
    confidence:
      availableCount === 2 ? "full" : availableCount === 1 ? "partial" : "unknown",
    lowWhenClear:
      availableCount === 2 &&
      simulationSuccess.value === true &&
      allWarningFactsKnown &&
      asTriState(go?.trading.isInDex ?? UNKNOWN) !== UNKNOWN &&
      reasons.length === 0,
  });
  const conflicts = [
    evidenceConflict("Honeypot result", honeypotEvidence),
    evidenceConflict("Buy tax", buyTaxPercent),
    evidenceConflict("Sell tax", sellTaxPercent),
    evidenceConflict("Transfer tax", transferTaxPercent),
  ].filter((item): item is EvidenceConflict => item !== null);

  return {
    trade: {
      simulationSuccess,
      simulationError,
      simulationFailureKind,
      honeypot: honeypotEvidence,
      honeypotReason,
      buyTaxPercent,
      sellTaxPercent,
      transferTaxPercent,
      cannotBuy,
      cannotSellAll,
      slippageModifiable,
      personalSlippageModifiable,
      transferPausable,
      tradingCooldown,
      hasMaxBuyRestriction,
      hasMaxSellRestriction,
      maxBuy,
      maxSell,
      risk,
    },
    conflicts,
  };
}
