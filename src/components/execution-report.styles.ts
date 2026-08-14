import { StyleSheet } from "react-native";

import { Colors, Radius, Spacing } from "@/constants/theme";

export const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: Spacing.md,
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginVertical: Spacing.xs,
  },

  value: {
    textAlign: "right",
    flexShrink: 1,
  },
});
