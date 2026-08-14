import { StyleSheet } from "react-native";

import { Colors, Radius, Spacing } from "@/constants/theme";

export const styles = StyleSheet.create({
  warning: {
    marginBottom: Spacing.lg,
  },

  cover: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    alignItems: "center",
    gap: Spacing.xs,
  },

  section: {
    marginTop: Spacing.xl,
    gap: Spacing.sm,
  },

  key: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },

  footnote: {
    marginTop: Spacing.xl,
  },
});
