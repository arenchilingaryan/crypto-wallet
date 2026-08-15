import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";

import { AppText } from "@/components/ui/text";
import { Colors } from "@/constants/theme";
import type {
  Availability,
  RiskLevel,
} from "@/core/token-intelligence/types";

import { styles } from "./token-intelligence.styles";

export type IntelligenceRiskLevel = RiskLevel;
export type IntelligenceSectionStatus = Availability;

const RISK_LABEL: Record<IntelligenceRiskLevel, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
  unknown: "Unknown",
};

const RISK_TONE: Record<
  IntelligenceRiskLevel,
  "success" | "warning" | "danger" | "muted"
> = {
  low: "success",
  medium: "warning",
  high: "warning",
  critical: "danger",
  unknown: "muted",
};

const RISK_STYLE = {
  low: styles.badgeLow,
  medium: styles.badgeMedium,
  high: styles.badgeHigh,
  critical: styles.badgeCritical,
  unknown: styles.badgeUnknown,
};

export function RiskBadge({ level }: { level: IntelligenceRiskLevel }) {
  return (
    <View
      accessibilityLabel={`${RISK_LABEL[level]} risk`}
      style={[styles.badge, RISK_STYLE[level]]}
    >
      <AppText variant="overline" tone={RISK_TONE[level]}>
        {RISK_LABEL[level]}
      </AppText>
    </View>
  );
}

export function SectionCard({
  title,
  subtitle,
  status = "available",
  risk,
  unavailableMessage,
  partialMessage,
  onRetry,
  children,
}: {
  title: string;
  subtitle?: string;
  status?: IntelligenceSectionStatus;
  risk?: IntelligenceRiskLevel;
  unavailableMessage?: string;
  partialMessage?: string;
  onRetry?: () => void;
  children?: ReactNode;
}) {
  return (
    <View
      style={[
        styles.section,
        (risk === "medium" || risk === "high") && styles.sectionAttention,
        risk === "critical" && styles.sectionCritical,
      ]}
    >
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeading}>
          <AppText variant="overline" tone="muted">
            {title}
          </AppText>

          {subtitle ? (
            <AppText variant="caption" tone="muted">
              {subtitle}
            </AppText>
          ) : null}
        </View>

        {risk ? <RiskBadge level={risk} /> : null}
      </View>

      {status === "loading" ? (
        <View style={[styles.state, styles.stateInline]}>
          <ActivityIndicator color={Colors.textSecondary} />
          <AppText variant="caption" tone="muted">
            Checking current data…
          </AppText>
        </View>
      ) : null}

      {status === "unsupported" ? (
        <View style={styles.state}>
          {/* Not "unavailable": that word belongs to a check that was tried
              and failed. This one was never possible here, and retrying will
              never change it. */}
          <AppText variant="bodyStrong">Not covered on this network</AppText>
          <AppText variant="caption" tone="muted">
            This provider does not support the selected network.
          </AppText>
        </View>
      ) : null}

      {status === "unavailable" ? (
        <View style={styles.state}>
          <AppText variant="bodyStrong">Data temporarily unavailable</AppText>
          <AppText variant="caption" tone="muted">
            {unavailableMessage ?? "No result was returned. Nothing was assumed."}
          </AppText>
          {onRetry ? (
            <RetryButton
              accessibilityLabel={`Retry ${title.toLowerCase()} token intelligence`}
              onPress={onRetry}
            />
          ) : null}
        </View>
      ) : null}

      {status === "partial" ? (
        <>
          <View style={styles.partialNotice}>
            <AppText variant="label" tone="warning">
              Partial data
            </AppText>
            <AppText variant="caption" tone="muted">
              {partialMessage ??
                "Some providers did not return data. Unknown values remain unknown."}
            </AppText>
            {onRetry ? (
              <RetryButton
                accessibilityLabel={`Retry ${title.toLowerCase()} token intelligence`}
                onPress={onRetry}
              />
            ) : null}
          </View>
          {children}
        </>
      ) : null}

      {status === "available" ? children : null}
    </View>
  );
}

export function RetryButton({
  accessibilityLabel = "Retry token intelligence",
  onPress,
}: {
  accessibilityLabel?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
    >
      <AppText variant="label">Retry</AppText>
    </Pressable>
  );
}

export function MetricRow({
  label,
  value,
  detail,
  mono = false,
}: {
  label: string;
  value: string;
  detail?: string;
  mono?: boolean;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLabel}>
        <AppText variant="caption" tone="muted">
          {label}
        </AppText>
        {detail ? (
          <AppText variant="caption" tone="muted">
            {detail}
          </AppText>
        ) : null}
      </View>
      <AppText variant="bodyStrong" mono={mono} tabular style={styles.rowValue}>
        {value}
      </AppText>
    </View>
  );
}

export function FindingRow({
  title,
  detail,
  severity,
}: {
  title: string;
  detail?: string;
  severity: IntelligenceRiskLevel | "info";
}) {
  const tone =
    severity === "critical"
      ? "danger"
      : severity === "high" || severity === "medium"
        ? "warning"
        : severity === "low"
          ? "success"
          : "muted";
  const mark =
    severity === "critical"
      ? "✕"
      : severity === "high" || severity === "medium"
        ? "!"
        : severity === "low"
          ? "✓"
          : "•";

  return (
    <View style={styles.finding}>
      <AppText variant="bodyStrong" tone={tone} style={styles.findingMark}>
        {mark}
      </AppText>
      <View style={styles.findingBody}>
        <AppText variant="bodyStrong" tone={severity === "critical" ? "danger" : "primary"}>
          {title}
        </AppText>
        {detail ? (
          <AppText variant="caption" tone="muted">
            {detail}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

export function formatObservedAge(observedAt: number, now = Date.now()) {
  if (!Number.isFinite(observedAt) || observedAt <= 0) {
    return "Check time unknown";
  }

  const seconds = Math.max(0, Math.floor((now - observedAt) / 1_000));

  if (seconds < 5) {
    return "Checked just now";
  }

  if (seconds < 60) {
    return `Checked ${seconds} sec ago`;
  }

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return `Checked ${minutes} min ago`;
  }

  const hours = Math.floor(minutes / 60);

  return `Checked ${hours} hr ago`;
}
