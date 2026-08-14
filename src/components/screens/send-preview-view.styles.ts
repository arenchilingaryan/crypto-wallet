import { StyleSheet } from "react-native";

import { Colors, Radius, Spacing } from "@/constants/theme";

export const styles = StyleSheet.create({
  header: {
    gap: Spacing.lg,
    marginBottom: Spacing.xxl,
  },

  backButton: {
    alignSelf: "flex-start",
    paddingVertical: Spacing.sm,
  },

  amount: {
    alignItems: "center",
    gap: Spacing.sm,

    marginBottom: Spacing.xxl,
  },

  details: {
    padding: Spacing.lg,

    gap: Spacing.lg,

    backgroundColor: Colors.surface,

    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",

    gap: Spacing.lg,
  },

  rowValue: {
    flexShrink: 1,
    textAlign: "right",
  },

  divider: {
    height: 1,
    backgroundColor: Colors.border,
  },

  notice: {
    marginTop: Spacing.lg,
  },

  intelNotice: {
    marginTop: Spacing.lg,
  },

  lookalike: {
    marginTop: Spacing.lg,

    padding: Spacing.lg,

    gap: Spacing.sm,

    backgroundColor: Colors.surface,

    borderWidth: 1,
    borderColor: Colors.danger,
    borderRadius: Radius.lg,
  },

  lookalikeAddress: {
    marginTop: Spacing.xs,

    padding: Spacing.sm,

    backgroundColor: Colors.surfaceAlt,

    borderRadius: Radius.sm,
  },

  confirmDanger: {
    borderColor: Colors.danger,
  },

  confirmButton: {
    minHeight: 52,
    marginTop: Spacing.xl,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: Colors.surfaceAlt,

    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
  },

  disabled: {
    opacity: 0.45,
  },

  pressed: {
    opacity: 0.65,
  },
});
