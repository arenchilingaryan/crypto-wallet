import { StyleSheet } from "react-native";

import { Colors, Radius, Spacing } from "@/constants/theme";

export const styles = StyleSheet.create({
  stack: {
    gap: Spacing.lg,
  },

  section: {
    gap: Spacing.md,
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
  },

  sectionAttention: {
    borderColor: Colors.warning,
  },

  sectionCritical: {
    borderColor: Colors.danger,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: Spacing.md,
  },

  sectionHeading: {
    flex: 1,
    gap: 2,
  },

  badge: {
    minHeight: 24,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.full,
  },

  badgeLow: {
    borderColor: Colors.success,
    backgroundColor: "rgba(160, 175, 84, 0.10)",
  },

  badgeMedium: {
    borderColor: Colors.warning,
    backgroundColor: "rgba(208, 162, 21, 0.10)",
  },

  badgeHigh: {
    borderColor: Colors.warning,
    backgroundColor: "rgba(208, 162, 21, 0.18)",
  },

  badgeCritical: {
    borderColor: Colors.danger,
    backgroundColor: "rgba(209, 77, 65, 0.12)",
  },

  badgeUnknown: {
    borderColor: Colors.borderStrong,
    backgroundColor: Colors.surfaceAlt,
  },

  state: {
    minHeight: 88,
    alignItems: "flex-start",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },

  stateInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },

  partialNotice: {
    gap: 2,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceAlt,
  },

  retry: {
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderStrong,
    borderRadius: Radius.md,
  },

  pressed: {
    opacity: 0.65,
  },

  axes: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },

  axis: {
    minWidth: "46%",
    flexGrow: 1,
    gap: 2,
    padding: Spacing.md,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
  },

  rows: {
    gap: Spacing.md,
  },

  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: Spacing.lg,
  },

  rowLabel: {
    flex: 1,
  },

  rowValue: {
    maxWidth: "58%",
    flexShrink: 1,
    textAlign: "right",
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
  },

  finding: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },

  findingMark: {
    width: 18,
    paddingTop: 1,
  },

  findingBody: {
    flex: 1,
    gap: 2,
  },

  evidenceList: {
    gap: Spacing.sm,
  },

  evidence: {
    gap: 3,
    padding: Spacing.md,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
  },

  conflict: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.danger,
    backgroundColor: "rgba(209, 77, 65, 0.08)",
  },

  holder: {
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },

  holderHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.md,
  },

  holderIdentity: {
    minWidth: 0,
    flex: 1,
    gap: 3,
  },

  holderAmount: {
    alignItems: "flex-end",
    gap: 2,
  },

  holderDetails: {
    gap: Spacing.sm,
    marginTop: Spacing.xs,
    padding: Spacing.md,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
  },

  category: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderStrong,
    borderRadius: Radius.full,
  },

  distribution: {
    gap: Spacing.md,
  },

  distributionTrack: {
    height: 8,
    overflow: "hidden",
    flexDirection: "row",
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.full,
  },

  distributionLiquidity: {
    backgroundColor: Colors.accent,
  },

  distributionBurn: {
    backgroundColor: Colors.textMuted,
  },

  distributionLocked: {
    backgroundColor: Colors.success,
  },

  distributionWhales: {
    backgroundColor: Colors.warning,
  },

  distributionOther: {
    backgroundColor: Colors.borderStrong,
  },

  pool: {
    gap: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
  },

  poolHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: Spacing.md,
  },

  age: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.md,
  },

  briefing: {
    flex: 1,
    justifyContent: "space-between",
    gap: Spacing.xxl,
  },

  briefingContent: {
    gap: Spacing.xl,
  },

  briefingHeader: {
    gap: Spacing.sm,
  },

  briefingActions: {
    flexDirection: "row",
    gap: Spacing.md,
  },

  briefingButton: {
    flex: 1,
  },

  actionButton: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
  },

  actionPrimary: {
    borderColor: Colors.action,
    backgroundColor: Colors.action,
  },

  actionSecondary: {
    borderColor: Colors.borderStrong,
    backgroundColor: Colors.surface,
  },

  actionPrimaryLabel: {
    color: Colors.actionText,
  },
});
