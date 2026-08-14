import type {
  ProviderId,
  RiskConfidence,
  RiskLevel,
  RiskReason,
  RiskResult,
} from "./types";

const RISK_RANK: Record<RiskLevel, number> = {
  unknown: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export function highestRisk(levels: readonly RiskLevel[]): RiskLevel {
  return levels.reduce<RiskLevel>(
    (highest, level) =>
      RISK_RANK[level] > RISK_RANK[highest] ? level : highest,
    "unknown",
  );
}

export function reason(
  code: string,
  level: RiskReason["level"],
  message: string,
  sources: readonly ProviderId[],
): RiskReason {
  return {
    code,
    level,
    message,
    sources: [...new Set(sources)],
  };
}

export function resultFromReasons({
  reasons,
  confidence,
  lowWhenClear,
}: {
  reasons: readonly RiskReason[];
  confidence: RiskConfidence;
  lowWhenClear: boolean;
}): RiskResult {
  const actionable = reasons
    .map((item) => item.level)
    .filter((level): level is "medium" | "high" | "critical" =>
      level === "medium" || level === "high" || level === "critical",
    );

  return {
    level:
      actionable.length > 0
        ? highestRisk(actionable)
        : lowWhenClear
          ? "low"
          : "unknown",
    confidence,
    reasons,
  };
}

export function uniqueReasons(reasons: readonly RiskReason[]): RiskReason[] {
  const seen = new Set<string>();

  return reasons.filter((item) => {
    if (seen.has(item.code)) {
      return false;
    }

    seen.add(item.code);

    return true;
  });
}
