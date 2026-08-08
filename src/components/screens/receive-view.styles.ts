import { StyleSheet } from "react-native";

import { Colors, Radius, Spacing } from "@/constants/theme";

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  header: {
    gap: Spacing.xs,
  },

  qrSection: {
    marginTop: Spacing.xxl,
    alignItems: "center",
    justifyContent: "center",
  },

  qr: {
    padding: Spacing.lg,
    backgroundColor: "#FFFFFF",
    borderRadius: Radius.lg,
  },

  addressCard: {
    marginTop: Spacing.xl,
    padding: Spacing.lg,
    gap: Spacing.sm,

    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
  },

  address: {
    lineHeight: 22,
  },

  copyButton: {
    minHeight: 52,
    marginTop: Spacing.lg,

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
    marginTop: Spacing.lg,
    textAlign: "center",
  },
});
