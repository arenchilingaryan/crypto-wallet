import { View } from "react-native";

import type {
  RiskReason,
  TokenIntelligence,
  TradeIntelligence,
} from "@/core/token-intelligence/types";

import {
  evidenceSources,
  formatNumberValue,
  formatPercent,
  formatSources,
} from "./formatters";
import { FindingRow, MetricRow, SectionCard } from "./primitives";
import { styles } from "./token-intelligence.styles";

function currentStatus(trade: TradeIntelligence) {
  if (
    trade.honeypot.value === true ||
    trade.simulationFailureKind.value === "cannot-sell" ||
    (trade.sellTaxPercent.value !== "unknown" &&
      trade.sellTaxPercent.value >= 100)
  ) {
    return "May not be sellable";
  }

  if (trade.cannotBuy.value === true) {
    return "May not be buyable";
  }

  if (trade.risk.level === "critical") {
    return "Critical trade finding detected";
  }

  if (trade.cannotSellAll.value === true) {
    return "Full-balance selling is restricted";
  }

  if (trade.simulationSuccess.value === true) {
    return trade.honeypot.value === false
      ? "No current trade failure detected"
      : "Simulation completed; result incomplete";
  }

  if (trade.simulationSuccess.value === false) {
    return "Simulation failed";
  }

  return "Unknown";
}

function reasonDetail(reason: RiskReason) {
  return reason.sources.length > 0
    ? `Source: ${formatSources(reason.sources)}`
    : undefined;
}

export function TradeSafetyCard({
  intelligence,
  onRetry,
}: {
  intelligence: TokenIntelligence;
  onRetry?: () => void;
}) {
  const trade = intelligence.tradeSafety;
  const simulation = trade.simulationSuccess.value;
  const simulationClear =
    simulation === true &&
    trade.honeypot.value === false &&
    trade.risk.level === "low";

  return (
    <SectionCard
      title="Trade safety"
      status={intelligence.availability.trade}
      risk={trade.risk.level}
      unavailableMessage="Trade simulation and restriction data could not be checked."
      partialMessage="Trade facts came from only part of the configured evidence."
      onRetry={onRetry}
    >
      <View style={styles.rows}>
        {simulation === true ? (
          <FindingRow
            severity={simulationClear ? "low" : "info"}
            title={
              simulationClear
                ? "Current trade simulation passed"
                : "Trade simulation completed"
            }
            detail={
              simulationClear
                ? `No execution failure was returned. Source: ${evidenceSources(trade.simulationSuccess)}`
                : `The simulation ran, but other findings do not prove the token is tradable. Source: ${evidenceSources(trade.simulationSuccess)}`
            }
          />
        ) : simulation === false ? (
          <FindingRow
            severity={trade.risk.level === "critical" ? "critical" : "high"}
            title="Trade simulation failed"
            detail={
              trade.simulationError.value === "unknown"
                ? `Source: ${evidenceSources(trade.simulationSuccess)}`
                : trade.simulationError.value
            }
          />
        ) : (
          <FindingRow
            severity="info"
            title="Trade simulation unknown"
            detail="No successful simulation result was returned."
          />
        )}

        <View style={styles.divider} />

        <MetricRow
          label="Buy tax"
          value={formatPercent(trade.buyTaxPercent.value)}
          detail={evidenceSources(trade.buyTaxPercent)}
        />
        <MetricRow
          label="Sell tax"
          value={formatPercent(trade.sellTaxPercent.value)}
          detail={evidenceSources(trade.sellTaxPercent)}
        />
        <MetricRow
          label="Transfer tax"
          value={formatPercent(trade.transferTaxPercent.value)}
          detail={evidenceSources(trade.transferTaxPercent)}
        />

        <View style={styles.divider} />

        <MetricRow
          label="Max buy"
          value={
            trade.hasMaxBuyRestriction.value === false
              ? "No limit detected"
              : formatNumberValue(trade.maxBuy.value)
          }
          detail={evidenceSources(trade.hasMaxBuyRestriction)}
        />
        <MetricRow
          label="Max sell"
          value={
            trade.hasMaxSellRestriction.value === false
              ? "No limit detected"
              : formatNumberValue(trade.maxSell.value)
          }
          detail={evidenceSources(trade.hasMaxSellRestriction)}
        />
        <MetricRow label="Current status" value={currentStatus(trade)} />
      </View>

      {trade.risk.reasons.length > 0 ? (
        <View style={styles.rows}>
          <View style={styles.divider} />
          {trade.risk.reasons.map((reason) => (
            <FindingRow
              key={`${reason.code}:${reason.message}`}
              severity={reason.level}
              title={reason.message}
              detail={reasonDetail(reason)}
            />
          ))}
        </View>
      ) : null}
    </SectionCard>
  );
}
