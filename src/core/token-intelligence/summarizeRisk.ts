import type {
  Availability,
  RiskResult,
  TokenSafetySummary,
} from "./types";

export function summarizeTokenRisk({
  trade,
  contract,
  holders,
  liquidity,
  availability,
}: {
  trade: RiskResult;
  contract: RiskResult;
  holders: RiskResult;
  liquidity: RiskResult;
  availability: readonly Availability[];
}): TokenSafetySummary {
  const axes = [trade, contract, holders, liquidity];
  const detectedRisks = new Set<string>();

  for (const axis of axes) {
    for (const item of axis.reasons) {
      if (
        item.level === "medium" ||
        item.level === "high" ||
        item.level === "critical"
      ) {
        detectedRisks.add(`${item.code}:${item.message}`);
      }
    }
  }

  const detectedRiskCount = detectedRisks.size;

  if (trade.level === "critical") {
    return {
      kind: "critical",
      title: trade.reasons.some(
        (item) =>
          item.code === "honeypot-detected" ||
          item.code === "honeypot-conflict" ||
          item.code === "sell-simulation-failed",
      )
        ? "Token may not be sellable"
        : "Critical trade findings",
      detectedRiskCount,
    };
  }

  if (
    axes.some((axis) => axis.level === "high" || axis.level === "critical")
  ) {
    return {
      kind: "high",
      title: `${detectedRiskCount} risk${detectedRiskCount === 1 ? "" : "s"} detected`,
      detectedRiskCount,
    };
  }

  if (
    axes.some((axis) => axis.level === "unknown") ||
    availability.some(
      (item) =>
        item === "loading" ||
        item === "partial" ||
        item === "unavailable" ||
        item === "unsupported",
    )
  ) {
    return {
      kind: "incomplete",
      title: "Incomplete data",
      detectedRiskCount,
    };
  }

  return {
    kind: "no-major-issues",
    title: "No major issues detected",
    detectedRiskCount,
  };
}
