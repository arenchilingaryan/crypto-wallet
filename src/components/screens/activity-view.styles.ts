import { StyleSheet } from "react-native";

import { Colors, Radius, Spacing } from "@/constants/theme";

export const styles = StyleSheet.create({
  screen: {
    gap: Spacing.lg,
  },

  header: {
    gap: Spacing.md,
  },

  backButton: {
    alignSelf: "flex-start",

    paddingHorizontal: Spacing.md,

    paddingVertical: Spacing.sm,

    borderWidth: 1,

    borderColor: Colors.border,

    borderRadius: Radius.full,

    backgroundColor: Colors.surface,
  },

  list: {
    gap: Spacing.sm,
  },

  row: {
    minHeight: 78,

    flexDirection: "row",

    alignItems: "center",

    justifyContent: "space-between",

    gap: Spacing.md,

    padding: Spacing.md,

    borderWidth: 1,

    borderColor: Colors.border,

    borderRadius: Radius.md,

    backgroundColor: Colors.surface,
  },

  left: {
    flex: 1,

    gap: 3,
  },

  right: {
    alignItems: "flex-end",

    gap: 2,
  },

  empty: {
    gap: Spacing.xs,

    paddingVertical: Spacing.xl,
  },

  pressed: {
    opacity: 0.65,
  },
});
