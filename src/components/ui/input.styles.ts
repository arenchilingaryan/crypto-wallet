import { Platform, StyleSheet } from "react-native";

import { Colors, Fonts, Radius, Spacing, TypeScale } from "@/constants/theme";

export const styles = StyleSheet.create({
  field: {
    gap: Spacing.sm,
  },
  input: {
    ...TypeScale.body,
    color: Colors.textPrimary,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    minHeight: 48,

    ...Platform.select({
      web: { outlineStyle: "solid" as const, outlineWidth: 0 },
    }),
  },
  mono: {
    fontFamily: Fonts.mono,
    letterSpacing: 0.2,
  },
  focused: {
    borderColor: Colors.textMuted,
  },
  errored: {
    borderColor: Colors.danger,
  },
});
