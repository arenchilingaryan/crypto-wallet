import { StyleSheet } from "react-native";

import { Colors, Radius, Spacing } from "@/constants/theme";

export const styles = StyleSheet.create({
  header: {
    flexDirection: "row",

    alignItems: "flex-start",
    justifyContent: "space-between",

    gap: Spacing.md,
  },

  identity: {
    flex: 1,

    gap: Spacing.sm,
  },

  walletButton: {
    flexDirection: "row",

    alignItems: "center",

    alignSelf: "flex-start",

    gap: Spacing.xs,
  },

  headerButtons: {
    flexDirection: "row",

    alignItems: "center",

    gap: Spacing.sm,
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

  addressActions: {
    flexDirection: "row",

    alignItems: "center",

    gap: Spacing.sm,
  },

  copyIconButton: {
    width: 34,
    height: 34,

    alignItems: "center",
    justifyContent: "center",

    borderWidth: 1,
    borderColor: Colors.border,

    borderRadius: Radius.full,

    backgroundColor: Colors.surface,
  },

  pressed: {
    opacity: 0.6,
  },

  balance: {
    alignItems: "center",

    gap: Spacing.sm,

    marginTop: Spacing.xxl,
  },

  balanceValue: {
    textAlign: "center",
  },

  balanceNote: {
    textAlign: "center",
    maxWidth: 280,
  },

  actions: {
    flexDirection: "row",

    alignItems: "flex-start",

    marginTop: Spacing.xxl,
  },

  assetsHeading: {
    marginTop: Spacing.xxl,
    marginBottom: Spacing.sm,
  },

  assetsSpinner: {
    marginTop: Spacing.xl,
    alignSelf: "center",
  },

  assetDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },

  listFooter: {
    height: Spacing.xl,
  },
});
