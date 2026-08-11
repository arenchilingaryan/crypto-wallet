import { StyleSheet } from "react-native";

import { Colors, Radius, Spacing } from "@/constants/theme";

export const styles = StyleSheet.create({
  screen: {
    gap: Spacing.xl,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },

  backButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
  },

  hero: {
    gap: Spacing.sm,
  },

  card: {
    gap: Spacing.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
  },

  row: {
    gap: Spacing.xs,
  },

  rowValue: {
    width: "100%",
  },

  pressed: {
    opacity: 0.6,
  },
});
