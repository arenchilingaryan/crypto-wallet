import { StyleSheet } from "react-native";

import { Colors, Radius, Spacing } from "@/constants/theme";

export const styles = StyleSheet.create({
  notice: {
    marginBottom: Spacing.xl,
  },

  rule: {
    backgroundColor: Colors.surface,

    borderWidth: 1,
    borderColor: Colors.border,

    borderRadius: Radius.lg,

    padding: Spacing.lg,

    gap: Spacing.md,

    marginBottom: Spacing.md,
  },

  ruleHeader: {
    gap: Spacing.xs,
  },

  inputRow: {
    flexDirection: "row",

    alignItems: "center",

    gap: Spacing.sm,
  },

  currency: {
    width: 18,
  },

  input: {
    flex: 1,

    minHeight: 44,

    paddingHorizontal: Spacing.md,

    color: Colors.textPrimary,

    backgroundColor: Colors.surfaceAlt,

    borderWidth: 1,
    borderColor: Colors.border,

    borderRadius: Radius.md,

    fontSize: 16,
  },

  footerNote: {
    marginTop: Spacing.lg,
  },
});
