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
  network: {
    flexDirection: "row",
    alignItems: "center",
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
});
