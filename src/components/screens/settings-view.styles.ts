import { StyleSheet } from "react-native";

import { Colors, Radius, Spacing } from "@/constants/theme";

export const styles = StyleSheet.create({
  heading: {
    marginBottom: Spacing.xl,
  },

  section: {
    marginBottom: Spacing.xl,

    gap: Spacing.sm,
  },

  card: {
    backgroundColor: Colors.surface,

    borderWidth: 1,
    borderColor: Colors.border,

    borderRadius: Radius.lg,

    overflow: "hidden",
  },

  row: {
    flexDirection: "row",

    alignItems: "center",

    gap: Spacing.md,

    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
  },

  rowPressed: {
    backgroundColor: Colors.surfaceAlt,
  },

  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,

    borderTopColor: Colors.border,
  },

  rowText: {
    flex: 1,

    gap: 2,
  },
});
