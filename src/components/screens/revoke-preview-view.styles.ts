import { StyleSheet } from "react-native";

import { Colors, Radius, Spacing } from "@/constants/theme";

export const styles = StyleSheet.create({
  header: {
    gap: Spacing.sm,

    marginBottom: Spacing.xl,
  },

  card: {
    backgroundColor: Colors.surface,

    borderWidth: 1,
    borderColor: Colors.border,

    borderRadius: Radius.lg,

    paddingHorizontal: Spacing.lg,
  },

  row: {
    flexDirection: "row",

    alignItems: "center",
    justifyContent: "space-between",

    gap: Spacing.md,

    paddingVertical: Spacing.lg,
  },

  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },

  rowValue: {
    flexShrink: 1,

    textAlign: "right",
  },

  notice: {
    marginTop: Spacing.lg,
  },
});
