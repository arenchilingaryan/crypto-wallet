import { StyleSheet } from "react-native";

import { Colors, Radius, Spacing } from "@/constants/theme";

export const styles = StyleSheet.create({
  row: {
    padding: Spacing.lg,

    gap: Spacing.md,

    backgroundColor: Colors.surface,

    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
  },

  rowPressed: {
    backgroundColor: Colors.surfaceAlt,
  },

  top: {
    flexDirection: "row",

    alignItems: "center",

    gap: Spacing.md,
  },

  identity: {
    flex: 1,

    gap: 2,
  },

  amounts: {
    // Price and "Price unavailable" use different type sizes; a fixed height
    // keeps the header from resizing when one replaces the other.
    minHeight: 24,

    justifyContent: "center",

    alignItems: "flex-end",

    gap: 2,
  },

  removeButton: {
    alignSelf: "flex-start",

    marginTop: Spacing.xs,

    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,

    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.full,
  },

  removeButtonPressed: {
    backgroundColor: Colors.surfaceAlt,
  },

  details: {
    // Reserve the space the filled-in row will need, so a row does not jump
    // when its first observation arrives. Sized for the tallest case: risk
    // line + liquidity + status + the Remove control beneath them.
    minHeight: 110 + StyleSheet.hairlineWidth,

    gap: Spacing.xs,

    paddingTop: Spacing.md,

    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
});
