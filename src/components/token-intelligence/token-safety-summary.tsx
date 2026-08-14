import { View } from "react-native";

import { AppText } from "@/components/ui/text";
import type {
  RiskLevel,
  TokenIntelligence,
} from "@/core/token-intelligence/types";

import { RiskBadge, SectionCard, formatObservedAge } from "./primitives";
import { styles } from "./token-intelligence.styles";

function summaryRisk(intelligence: TokenIntelligence): RiskLevel {
  switch (intelligence.summary.kind) {
    case "critical":
      return "critical";
    case "high":
      return "high";
    case "incomplete":
      return "unknown";
    case "no-major-issues":
      return "low";
  }
}

export function TokenSafetySummary({
  intelligence,
  onRetry,
  now,
}: {
  intelligence: TokenIntelligence;
  onRetry?: () => void;
  now?: number;
}) {
  const axes = [
    { label: "Trade", result: intelligence.tradeSafety.risk },
    { label: "Contract", result: intelligence.contractSafety.risk },
    { label: "Holders", result: intelligence.holders.risk },
    { label: "Liquidity", result: intelligence.liquidity.risk },
  ] as const;
  const stale = Object.entries(intelligence.freshness)
    .filter(([, freshness]) => freshness === "stale")
    .map(([facet]) => facet);

  return (
    <SectionCard
      title="Token safety"
      status={intelligence.availability.overall}
      risk={summaryRisk(intelligence)}
      unavailableMessage="Security providers did not return a usable result. No safety conclusion was made."
      partialMessage="At least one security source is unavailable. Risk axes show only the evidence that returned."
      onRetry={onRetry}
    >
      <View style={styles.sectionHeading}>
        <AppText
          variant="heading"
          tone={intelligence.summary.kind === "critical" ? "danger" : "paper"}
        >
          {intelligence.summary.title}
        </AppText>
        <AppText variant="caption" tone="muted">
          {intelligence.summary.detectedRiskCount === 1
            ? "1 concrete risk detected"
            : `${intelligence.summary.detectedRiskCount} concrete risks detected`}
        </AppText>
      </View>

      <View style={styles.axes}>
        {axes.map(({ label, result }) => (
          <View key={label} style={styles.axis}>
            <AppText variant="caption" tone="muted">
              {label}
            </AppText>
            <RiskBadge level={result.level} />
            {result.confidence !== "full" ? (
              <AppText variant="caption" tone="muted">
                {result.confidence === "partial" ? "Partial evidence" : "Confidence unknown"}
              </AppText>
            ) : null}
          </View>
        ))}
      </View>

      {stale.length > 0 ? (
        <AppText variant="caption" tone="warning">
          Stale snapshot: {stale.join(", ")}. Refresh before trading.
        </AppText>
      ) : null}

      <View style={styles.age}>
        <AppText variant="caption" tone="muted">
          {intelligence.observedAt === "unknown"
            ? "Check time unknown"
            : formatObservedAge(intelligence.observedAt, now)}
        </AppText>
      </View>
    </SectionCard>
  );
}
