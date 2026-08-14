import { View } from "react-native";

import { AppText } from "@/components/ui/text";
import type {
  LiquidityPool,
  TokenIntelligence,
} from "@/core/token-intelligence/types";
import { shortenAddress } from "@/utils/format";

import {
  formatDate,
  formatMetric,
  formatSources,
  formatTextValue,
  formatUsdValue,
  qualityDetail,
  sourceLabel,
} from "./formatters";
import { FindingRow, MetricRow, SectionCard, formatObservedAge } from "./primitives";
import { styles } from "./token-intelligence.styles";

function PoolCard({ pool, index }: { pool: LiquidityPool; index: number }) {
  return (
    <View style={styles.pool}>
      <View style={styles.poolHeader}>
        <View style={styles.sectionHeading}>
          <AppText variant="overline" tone="muted">
            {index === 0 ? "Main pool" : `Pool ${index + 1}`}
          </AppText>
          <AppText variant="bodyStrong">
            {formatTextValue(pool.tokenPair)}
          </AppText>
          <AppText variant="caption" tone="muted">
            {sourceLabel(pool.source)} · {formatObservedAge(pool.observedAt)}
          </AppText>
        </View>
        <AppText variant="bodyStrong" tabular>
          {formatUsdValue(pool.liquidityUsd)}
        </AppText>
      </View>

      <View style={styles.rows}>
        <MetricRow label="DEX" value={formatTextValue(pool.dex)} />
        <MetricRow label="Pool type" value={formatTextValue(pool.pairType)} />
        <MetricRow
          label="Pool address"
          value={
            pool.address === "unknown" ? "Unknown" : shortenAddress(pool.address)
          }
          mono={pool.address !== "unknown"}
        />
        <MetricRow label="Router" value={formatTextValue(pool.router)} mono={pool.router !== "unknown"} />
        <MetricRow label="Created" value={formatDate(pool.createdAtMs)} />
      </View>
    </View>
  );
}

export function LiquidityCard({
  intelligence,
  onRetry,
}: {
  intelligence: TokenIntelligence;
  onRetry?: () => void;
}) {
  const liquidity = intelligence.liquidity;

  return (
    <SectionCard
      title="Liquidity"
      status={intelligence.availability.liquidity}
      risk={liquidity.risk.level}
      unavailableMessage="Liquidity providers did not return a usable result."
      partialMessage="Only some pools or liquidity sources returned. The total may be incomplete."
      onRetry={onRetry}
    >
      <MetricRow
        label="Total detected liquidity"
        value={formatMetric(liquidity.totalLiquidityUsd, formatUsdValue)}
        detail={qualityDetail(liquidity.totalLiquidityUsd)}
      />

      {liquidity.pools.length > 0 ? (
        <View style={styles.rows}>
          {liquidity.pools.map((pool, index) => (
            <PoolCard
              key={`${pool.source}:${pool.address}:${index}`}
              pool={pool}
              index={index}
            />
          ))}
        </View>
      ) : (
        <AppText variant="caption" tone="muted">
          No pool records were returned. This is not evidence of zero liquidity.
        </AppText>
      )}

      {liquidity.risk.reasons.length > 0 ? (
        <View style={styles.rows}>
          <View style={styles.divider} />
          {liquidity.risk.reasons.map((reason) => (
            <FindingRow
              key={`${reason.code}:${reason.message}`}
              severity={reason.level}
              title={reason.message}
              detail={
                reason.sources.length > 0
                  ? `Source: ${formatSources(reason.sources)}`
                  : undefined
              }
            />
          ))}
        </View>
      ) : null}
    </SectionCard>
  );
}
