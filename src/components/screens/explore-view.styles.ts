import { StyleSheet } from "react-native";

import { Colors, Radius, Spacing } from "@/constants/theme";

export const styles = StyleSheet.create({
  header: {
    flexDirection: "row",

    alignItems: "center",
    justifyContent: "space-between",

    gap: Spacing.md,
  },

  iconButton: {
    width: 42,
    height: 42,

    alignItems: "center",
    justifyContent: "center",

    borderWidth: 1,
    borderColor: Colors.border,

    borderRadius: Radius.full,

    backgroundColor: Colors.surface,
  },

  segments: {
    flexDirection: "row",

    alignSelf: "flex-start",

    marginTop: Spacing.lg,

    padding: Spacing.xs,

    gap: Spacing.xs,

    borderWidth: 1,
    borderColor: Colors.border,

    borderRadius: Radius.full,

    backgroundColor: Colors.surface,
  },

  segment: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,

    borderRadius: Radius.full,
  },

  segmentActive: {
    backgroundColor: Colors.surfaceAlt,
  },

  watchlistRow: {
    flexDirection: "row",

    alignItems: "center",

    gap: Spacing.md,

    marginTop: Spacing.lg,

    // Comfortably above the ~44pt minimum touch target.
    minHeight: 64,

    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,

    backgroundColor: Colors.surface,

    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
  },

  watchlistRowPressed: {
    backgroundColor: Colors.surfaceAlt,
  },

  watchlistBadge: {
    width: 36,
    height: 36,

    alignItems: "center",
    justifyContent: "center",

    borderRadius: Radius.full,

    backgroundColor: Colors.surfaceAlt,
  },

  watchlistText: {
    flex: 1,

    gap: 2,
  },

  notice: {
    marginTop: Spacing.lg,
  },

  state: {
    marginTop: Spacing.xxl,

    alignItems: "center",

    gap: Spacing.sm,
  },

  list: {
    marginTop: Spacing.lg,
  },

  row: {
    flexDirection: "row",

    alignItems: "center",

    gap: Spacing.md,

    paddingVertical: Spacing.md,
  },

  rowPressed: {
    backgroundColor: Colors.surfaceAlt,

    borderRadius: Radius.sm,
  },

  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },

  identity: {
    flex: 1,

    gap: 2,
  },

  metrics: {
    flexDirection: "row",

    alignItems: "center",

    flexWrap: "wrap",

    gap: Spacing.sm,
  },

  amounts: {
    alignItems: "flex-end",

    gap: 2,
  },

  footer: {
    height: Spacing.xl,
  },
});
