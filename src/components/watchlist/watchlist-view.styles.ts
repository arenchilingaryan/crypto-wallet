import { StyleSheet } from "react-native";

import { Colors, Radius, Spacing } from "@/constants/theme";

export const styles = StyleSheet.create({
  heading: {
    marginBottom: Spacing.lg,
  },

  toolbar: {
    flexDirection: "row",

    alignItems: "center",
    justifyContent: "space-between",

    marginBottom: Spacing.md,
  },

  refreshButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,

    borderWidth: 1,
    borderColor: Colors.borderStrong,
    borderRadius: Radius.full,
  },

  refreshButtonPressed: {
    backgroundColor: Colors.surfaceAlt,
  },

  notice: {
    marginBottom: Spacing.md,
  },

  search: {
    minHeight: 44,

    paddingHorizontal: Spacing.lg,

    marginBottom: Spacing.lg,

    color: Colors.textPrimary,

    backgroundColor: Colors.surface,

    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
  },

  list: {
    gap: Spacing.sm,
  },

  state: {
    marginTop: Spacing.xl,

    alignItems: "center",

    gap: Spacing.md,
  },

  footerNote: {
    marginTop: Spacing.xl,
  },
});
