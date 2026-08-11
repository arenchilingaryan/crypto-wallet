import { StyleSheet } from "react-native";

import { Colors, Radius, Spacing } from "@/constants/theme";

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: Spacing.xl,
  },

  header: {
    gap: Spacing.xs,
  },

  qrSection: {
    alignItems: "center",
    paddingVertical: Spacing.lg,
  },

  qr: {
    padding: Spacing.lg,
    backgroundColor: "#FFFFFF",
    borderRadius: Radius.lg,
  },

  details: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
  },

  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.md,
  },

  detailBlock: {
    gap: Spacing.sm,
  },

  detailDivider: {
    height: 1,
    backgroundColor: Colors.border,
  },

  address: {
    lineHeight: 21,
  },

  copyButton: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
  },

  copyButtonPressed: {
    opacity: 0.65,
  },

  warning: {
    textAlign: "center",
    lineHeight: 20,
  },
});
