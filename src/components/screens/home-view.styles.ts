import { StyleSheet } from "react-native";

import { Colors, Radius, Spacing } from "@/constants/theme";

export const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  networkDot: {
    width: 6,
    height: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.success,
  },
  balance: {
    gap: Spacing.sm,
    marginTop: Spacing.xxl,
  },
  assetsHeading: {
    marginTop: Spacing.xxl,
    marginBottom: Spacing.sm,
  },
  assetsSpinner: {
    marginTop: Spacing.xl,
    alignSelf: "flex-start",
  },
  assetDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.lg,
    marginBottom: Spacing.xxl,
  },

  searchButton: {
    width: 44,
    height: 44,

    alignItems: "center",
    justifyContent: "center",

    borderWidth: 1,
    borderColor: Colors.border,

    borderRadius: Radius.full,

    backgroundColor: Colors.surface,
  },

  copyButton: {
    paddingHorizontal: Spacing.md,

    paddingVertical: Spacing.sm,

    backgroundColor: Colors.surface,

    borderWidth: 1,
    borderColor: Colors.border,

    borderRadius: Radius.full,
  },

  topRow: {
    flexDirection: "row",

    alignItems: "center",
    justifyContent: "space-between",

    gap: Spacing.md,
  },

  network: {
    flex: 1,

    gap: 2,
  },

  iconButton: {
    width: 44,
    height: 44,

    alignItems: "center",
    justifyContent: "center",

    borderWidth: 1,
    borderColor: Colors.border,

    borderRadius: Radius.full,

    backgroundColor: Colors.surface,
  },

  addressActions: {
    flexDirection: "row",

    alignItems: "center",

    gap: Spacing.sm,
  },

  copyIconButton: {
    width: 38,
    height: 38,

    alignItems: "center",
    justifyContent: "center",

    borderWidth: 1,
    borderColor: Colors.border,

    borderRadius: Radius.full,

    backgroundColor: Colors.surface,
  },

  copyFeedback: {
    alignSelf: "flex-end",

    marginTop: 2,
  },

  pressed: {
    opacity: 0.6,
  },

  walletActions: {
    flexDirection: "row",

    alignItems: "center",

    gap: Spacing.md,
  },

  walletAction: {
    alignItems: "center",

    gap: Spacing.xs,
  },

  walletActionIcon: {
    width: 48,
    height: 48,

    alignItems: "center",
    justifyContent: "center",

    borderWidth: 1,
    borderColor: Colors.border,

    borderRadius: Radius.full,

    backgroundColor: Colors.surface,
  },
});
