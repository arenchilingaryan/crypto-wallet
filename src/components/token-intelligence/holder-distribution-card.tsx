import { View } from "react-native";

import { AppText } from "@/components/ui/text";
import type {
  DomainMetric,
  TokenIntelligence,
} from "@/core/token-intelligence/types";

import {
  formatCount,
  formatMetric,
  qualityDetail,
} from "./formatters";
import { FindingRow, MetricRow, SectionCard } from "./primitives";
import { styles } from "./token-intelligence.styles";

function metricPercent(metric: DomainMetric<number>) {
  return formatMetric(metric, (value) => `${value.toFixed(1)}%`);
}

function otherPercent(intelligence: TokenIntelligence) {
  const metrics = intelligence.holders.metrics;
  const parts = [
    metrics.liquidityPoolPercent.value,
    metrics.burnPercent.value,
    metrics.knownLockedPercent.value,
    metrics.top10LiquidPercent.value,
  ];

  if (parts.some((value) => value === "unknown")) {
    return "unknown" as const;
  }

  const sum = (parts as number[]).reduce((total, value) => total + value, 0);

  return sum <= 100 ? Math.max(0, 100 - sum) : ("unknown" as const);
}

export function HolderDistributionCard({
  intelligence,
  onRetry,
}: {
  intelligence: TokenIntelligence;
  onRetry?: () => void;
}) {
  const holders = intelligence.holders;
  const metrics = holders.metrics;
  const remainder = otherPercent(intelligence);
  const distribution = [
    {
      label: "Liquidity pools",
      value: metrics.liquidityPoolPercent.value,
      style: styles.distributionLiquidity,
    },
    { label: "Burned", value: metrics.burnPercent.value, style: styles.distributionBurn },
    {
      label: "Known locked",
      value: metrics.knownLockedPercent.value,
      style: styles.distributionLocked,
    },
    {
      label: "Top 10 liquid",
      value: metrics.top10LiquidPercent.value,
      style: styles.distributionWhales,
    },
    { label: "Other / unclassified", value: remainder, style: styles.distributionOther },
  ] as const;

  return (
    <SectionCard
      title="Holders"
      subtitle={
        holders.quality === "complete"
          ? "Classified holder distribution"
          : "Distribution coverage is incomplete"
      }
      status={intelligence.availability.holders}
      risk={holders.risk.level}
      unavailableMessage="Holder distribution could not be retrieved."
      partialMessage="Concentration uses only classified, returned balances. Missing holders were not treated as zero."
      onRetry={onRetry}
    >
      <View style={styles.rows}>
        <MetricRow
          label="Total holders"
          value={formatCount(metrics.totalHolders.value)}
          detail={qualityDetail(metrics.totalHolders)}
        />
        <View style={styles.divider} />
        <MetricRow
          label="Largest liquid holder"
          value={metricPercent(metrics.largestLiquidHolderPercent)}
          detail={qualityDetail(metrics.largestLiquidHolderPercent)}
        />
        <MetricRow
          label="Top 5 liquid holders"
          value={metricPercent(metrics.top5LiquidPercent)}
          detail={qualityDetail(metrics.top5LiquidPercent)}
        />
        <MetricRow
          label="Top 10 liquid holders"
          value={metricPercent(metrics.top10LiquidPercent)}
          detail={qualityDetail(metrics.top10LiquidPercent)}
        />
        <MetricRow
          label="Raw top 10"
          value={metricPercent(metrics.rawTop10Percent)}
          detail="Before pool, burn, and proven lock exclusions"
        />
        <View style={styles.divider} />
        <MetricRow
          label="Deployer"
          value={metricPercent(metrics.deployerPercent)}
          detail={qualityDetail(metrics.deployerPercent)}
        />
        <MetricRow
          label="Owner"
          value={metricPercent(metrics.ownerPercent)}
          detail={qualityDetail(metrics.ownerPercent)}
        />
      </View>

      <View style={styles.divider} />

      <View style={styles.distribution}>
        <AppText variant="overline" tone="muted">
          Supply distribution
        </AppText>

        <View
          accessibilityLabel="Supply distribution bar"
          style={styles.distributionTrack}
        >
          {distribution.map((item) =>
            item.value !== "unknown" && item.value > 0 ? (
              <View
                key={item.label}
                style={[item.style, { flexBasis: 0, flexGrow: item.value }]}
              />
            ) : null,
          )}
        </View>

        <View style={styles.rows}>
          {distribution.map((item) => (
            <MetricRow
              key={item.label}
              label={item.label}
              value={item.value === "unknown" ? "Unknown" : `${item.value.toFixed(1)}%`}
            />
          ))}
        </View>
      </View>

      {holders.risk.reasons.length > 0 ? (
        <View style={styles.rows}>
          <View style={styles.divider} />
          {holders.risk.reasons.map((reason) => (
            <FindingRow
              key={`${reason.code}:${reason.message}`}
              severity={reason.level}
              title={reason.message}
              detail="Product concentration heuristic, not proof of fraud."
            />
          ))}
        </View>
      ) : null}
    </SectionCard>
  );
}
