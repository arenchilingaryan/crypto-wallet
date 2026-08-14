import { Pressable, View } from "react-native";

import { Screen } from "@/components/ui/screen";
import { AppText } from "@/components/ui/text";
import type {
  RiskReason,
  TokenIntelligence,
} from "@/core/token-intelligence/types";

import { formatSources } from "./formatters";
import { FindingRow, SectionCard, formatObservedAge } from "./primitives";
import { styles } from "./token-intelligence.styles";

const SEVERITY_ORDER: Record<RiskReason["level"], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  info: 3,
};

function briefingReasons(intelligence: TokenIntelligence) {
  const reasons = [
    ...intelligence.tradeSafety.risk.reasons,
    ...intelligence.contractSafety.risk.reasons,
    ...intelligence.holders.risk.reasons,
    ...intelligence.liquidity.risk.reasons,
  ];
  const seen = new Set<string>();

  return reasons
    .filter((reason) => {
      const key = `${reason.code}:${reason.message}`;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .sort((left, right) => SEVERITY_ORDER[left.level] - SEVERITY_ORDER[right.level])
    .slice(0, 5);
}

function headline(intelligence: TokenIntelligence) {
  if (
    intelligence.tradeSafety.honeypot.value === true ||
    intelligence.tradeSafety.risk.level === "critical"
  ) {
    return "TOKEN MAY NOT BE SELLABLE";
  }

  if (
    intelligence.summary.kind === "critical" ||
    intelligence.summary.kind === "high"
  ) {
    return "You are buying a high-risk token.";
  }

  if (intelligence.summary.kind === "incomplete") {
    return "Security data is incomplete.";
  }

  return "Pre-trade security briefing";
}

function SimulationFinding({ intelligence }: { intelligence: TokenIntelligence }) {
  const simulation = intelligence.tradeSafety.simulationSuccess;
  const simulationClear =
    simulation.value === true &&
    intelligence.tradeSafety.honeypot.value === false &&
    intelligence.tradeSafety.risk.level === "low";

  if (simulation.value === true) {
    return (
      <FindingRow
        severity={
          simulationClear
            ? "low"
            : intelligence.tradeSafety.risk.level === "critical"
              ? "critical"
              : "info"
        }
        title={
          simulationClear
            ? "Current trade simulation: PASSED"
            : "Current trade simulation: COMPLETED"
        }
        detail={
          simulationClear
            ? `No execution failure was returned. Source: ${formatSources(simulation.observations.map((item) => item.source))}`
            : `The simulation ran, but other findings do not prove the token is tradable. Source: ${formatSources(simulation.observations.map((item) => item.source))}`
        }
      />
    );
  }

  if (simulation.value === false) {
    return (
      <FindingRow
        severity={intelligence.tradeSafety.risk.level === "critical" ? "critical" : "high"}
        title="Current sell simulation: FAILED"
        detail={
          intelligence.tradeSafety.simulationError.value === "unknown"
            ? "The provider did not return a usable reason."
            : intelligence.tradeSafety.simulationError.value
        }
      />
    );
  }

  return (
    <FindingRow
      severity="info"
      title="Current sell simulation: UNKNOWN"
      detail="No result was assumed from missing data."
    />
  );
}

function BriefingButton({
  title,
  primary = false,
  disabled = false,
  onPress,
}: {
  title: string;
  primary?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.briefingButton,
        styles.actionButton,
        primary ? styles.actionPrimary : styles.actionSecondary,
        pressed && styles.pressed,
        disabled && styles.pressed,
      ]}
    >
      <AppText
        variant="bodyStrong"
        style={primary ? styles.actionPrimaryLabel : undefined}
      >
        {title}
      </AppText>
    </Pressable>
  );
}

export function TokenTradeBriefingView({
  intelligence,
  onCancel,
  onContinue,
  onRetry,
  refreshing = false,
  now,
}: {
  intelligence: TokenIntelligence;
  onCancel: () => void;
  onContinue: () => void;
  onRetry?: () => void;
  refreshing?: boolean;
  now?: number;
}) {
  const reasons = briefingReasons(intelligence);
  const critical = intelligence.tradeSafety.risk.level === "critical";

  return (
    <Screen scroll style={styles.briefing}>
      <View style={styles.briefingContent}>
        <View style={styles.briefingHeader}>
          <AppText variant="overline" tone="muted">
            Security briefing
          </AppText>
          <AppText variant="title" tone={critical ? "danger" : "paper"}>
            {headline(intelligence)}
          </AppText>
          <AppText variant="caption" tone="muted">
            {intelligence.token.symbol === "unknown"
              ? "Selected token"
              : intelligence.token.symbol}
            {" · "}
            {intelligence.observedAt === "unknown"
              ? "check time unknown"
              : formatObservedAge(intelligence.observedAt, now)}
          </AppText>
        </View>

        <SectionCard
          title="Current trade check"
          status={intelligence.availability.trade}
          risk={intelligence.tradeSafety.risk.level}
          unavailableMessage="The current sell simulation is unavailable. Continue only if you accept that uncertainty."
          partialMessage="The current trade check has partial provider coverage."
          onRetry={refreshing ? undefined : onRetry}
        >
          <SimulationFinding intelligence={intelligence} />
        </SectionCard>

        {reasons.length > 0 ? (
          <SectionCard title="Why this briefing is shown">
            <View style={styles.rows}>
              {reasons.map((reason) => (
                <FindingRow
                  key={`${reason.code}:${reason.message}`}
                  severity={reason.level}
                  title={reason.message}
                  detail={formatSources(reason.sources)}
                />
              ))}
            </View>
          </SectionCard>
        ) : (
          <SectionCard title="Observed result">
            <AppText variant="bodyStrong">{intelligence.summary.title}</AppText>
            <AppText variant="caption" tone="muted">
              This describes the returned checks; it is not a guarantee.
            </AppText>
          </SectionCard>
        )}

        {intelligence.evidence.conflicts.length > 0 ? (
          <AppText variant="caption" tone="danger">
            {intelligence.evidence.conflicts.length} provider conflict
            {intelligence.evidence.conflicts.length === 1 ? "" : "s"} detected. Review Token Intelligence for both observations.
          </AppText>
        ) : null}

        {intelligence.freshness.trade === "stale" ? (
          <AppText variant="caption" tone="warning">
            Trade-sensitive data is stale. Retry before continuing.
          </AppText>
        ) : null}

        {refreshing ? (
          <AppText variant="caption" tone="muted">
            Refreshing current trade data… Continue is disabled until it finishes.
          </AppText>
        ) : null}

        <AppText variant="caption" tone="muted">
          Informational only. Continuing does not bypass or change the existing Transaction Firewall.
        </AppText>
      </View>

      <View style={styles.briefingActions}>
        <BriefingButton title="Cancel" onPress={onCancel} />
        <BriefingButton
          title="Continue"
          primary
          disabled={refreshing}
          onPress={onContinue}
        />
      </View>
    </Screen>
  );
}
