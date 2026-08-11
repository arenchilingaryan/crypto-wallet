import { StyleSheet } from "react-native";

import { Colors, Radius, Spacing } from "@/constants/theme";

export const styles = StyleSheet.create({
  header: {
    gap: Spacing.lg,
    marginBottom: Spacing.xxl,
  },

  costInfo: {
    gap: 4,
    marginTop: 2,
  },

  costRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: Spacing.md,
  },

  backButton: {
    alignSelf: "flex-start",
    paddingVertical: Spacing.sm,
  },

  form: {
    gap: Spacing.xl,
  },

  field: {
    gap: Spacing.sm,
  },

  input: {
    minHeight: 56,

    paddingHorizontal: Spacing.lg,

    color: Colors.textPrimary,
    backgroundColor: Colors.surface,

    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,

    fontSize: 16,
  },

  continueButton: {
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

  disabled: {
    opacity: 0.5,
  },
});
