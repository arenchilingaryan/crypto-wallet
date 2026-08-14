import { StyleSheet } from "react-native";

import { Colors, Radius, Spacing } from "@/constants/theme";

export const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    gap: Spacing.md,
  },

  blockedCard: {
    borderColor: Colors.danger,
  },

  check: {
    flexDirection: "row",
    gap: Spacing.sm,
  },

  mark: {
    width: 16,
    paddingTop: 1,
  },

  checkText: {
    flex: 1,
    gap: 2,
  },
});
