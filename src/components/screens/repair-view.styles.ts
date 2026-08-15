import { StyleSheet } from "react-native";

import { Colors, Radius, Spacing } from "@/constants/theme";

export const styles = StyleSheet.create({
  loading: {
    paddingVertical: Spacing.xl,
  },

  notice: {
    marginBottom: Spacing.xl,
  },

  card: {
    backgroundColor: Colors.surface,

    borderWidth: 1,
    borderColor: Colors.border,

    borderRadius: Radius.lg,

    padding: Spacing.lg,

    gap: Spacing.sm,

    marginBottom: Spacing.md,
  },

  state: {
    marginTop: -Spacing.xs,
  },

  detail: {
    marginBottom: Spacing.xs,
  },
});
