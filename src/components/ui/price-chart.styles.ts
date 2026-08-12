import { StyleSheet } from "react-native";

import { Colors, Radius, Spacing } from "@/constants/theme";

export const CHART_HEIGHT = 160;

export const styles = StyleSheet.create({
  card: {
    marginTop: Spacing.xl,
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.xl,
    gap: Spacing.md,
    overflow: "hidden",
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: Spacing.md,
  },

  // Long prices shrink inside the column instead of pushing the
  // range pill out of the card (Yoga defaults to flexShrink: 0).
  identity: {
    flexShrink: 1,
    minWidth: 0,
  },

  price: {
    marginTop: Spacing.xs,
  },

  change: {
    marginTop: Spacing.xs,
  },

  rangePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    minHeight: 36,
    paddingHorizontal: Spacing.md,
    justifyContent: "center",
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.full,
    flexShrink: 0,
  },

  // Full bleed: the line and its gradient run to the card edges,
  // matching the reference. The card clips overflow at its radius.
  chartWrap: {
    height: CHART_HEIGHT,
    marginHorizontal: -Spacing.lg,
  },

  emptyChart: {
    height: CHART_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },

  ranges: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },

  rangeButton: {
    flex: 1,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
  },

  rangeButtonActive: {
    backgroundColor: Colors.surfaceAlt,
  },

  rangeButtonDisabled: {
    opacity: 0.35,
  },

  pressed: {
    opacity: 0.7,
  },

  // The percent belongs to the series; while a new range loads it dims
  // together with the line so stale numbers do not read as current.
  stale: {
    opacity: 0.4,
  },

  menuBackdrop: {
    flex: 1,
  },

  menu: {
    position: "absolute",
    minWidth: 96,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    borderRadius: Radius.md,
  },

  menuItem: {
    minHeight: 40,
    paddingHorizontal: Spacing.lg,
    justifyContent: "center",
  },

  // Active = one elevation step UP from the menu surface, same
  // convention as the active range button below the chart.
  menuItemActive: {
    backgroundColor: Colors.border,
  },
});
