import { StyleSheet } from "react-native";

import { Colors, Radius, Spacing } from "@/constants/theme";

export const styles = StyleSheet.create({
  error: {
    marginTop: Spacing.md,
  },

  walletList: {
    marginTop: Spacing.xl,
    gap: Spacing.sm,
  },

  walletRow: {
    flexDirection: "row",
    alignItems: "center",

    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,

    overflow: "hidden",
  },

  walletMain: {
    flex: 1,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },

  walletTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },

  activeBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,

    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceAlt,
  },

  removeButton: {
    alignSelf: "stretch",
    justifyContent: "center",

    paddingHorizontal: Spacing.lg,

    borderLeftWidth: 1,
    borderLeftColor: Colors.border,
  },

  actions: {
    marginTop: Spacing.xxl,
    gap: Spacing.sm,
  },

  action: {
    minHeight: 52,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
  },

  pressed: {
    opacity: 0.65,
  },
});
