import { StyleSheet } from "react-native";

import { Colors, Radius, Spacing } from "@/constants/theme";

export const styles = StyleSheet.create({
  assetHeader: {
    flexDirection: "row",

    alignItems: "center",

    gap: Spacing.md,
  },

  icon: {
    width: 52,
    height: 52,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  chartUnavailable: {
    minHeight: 260,
    alignItems: "center",
    justifyContent: "center",
  },

  logo: {
    width: "100%",
    height: "100%",
  },

  price: {
    marginTop: Spacing.xxl,
    gap: Spacing.xs,
  },

  chart: {
    height: 180,
    marginTop: Spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },

  actions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.xl,
  },

  action: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  actionDisabled: {
    opacity: 0.4,
  },

  actionPressed: {
    opacity: 0.65,
  },

  assetIdentity: {
    flex: 1,

    gap: 2,
  },

  details: {
    marginTop: Spacing.xxl,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },

  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.lg,
  },

  divider: {
    height: 1,
    marginVertical: Spacing.lg,
    backgroundColor: Colors.border,
  },

  contract: {
    gap: Spacing.sm,
  },
});
