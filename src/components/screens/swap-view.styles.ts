import { Platform, StyleSheet } from "react-native";

import { Colors, Radius, Spacing, TypeScale } from "@/constants/theme";

export const styles = StyleSheet.create({
  heading: {
    marginBottom: Spacing.xl,
  },

  card: {
    backgroundColor: Colors.surface,

    borderWidth: 1,
    borderColor: Colors.border,

    borderRadius: Radius.lg,

    padding: Spacing.lg,

    gap: Spacing.md,
  },

  cardRow: {
    flexDirection: "row",

    alignItems: "center",

    justifyContent: "space-between",

    gap: Spacing.md,
  },

  tokenSelector: {
    flexDirection: "row",

    alignItems: "center",

    gap: Spacing.sm,

    paddingVertical: Spacing.xs,
    paddingRight: Spacing.sm,

    borderRadius: Radius.full,

    flexShrink: 0,
  },

  tokenSelectorPressed: {
    opacity: 0.7,
  },

  tokenName: {
    gap: 2,
  },

  amount: {
    flex: 1,

    minWidth: 0,

    alignItems: "flex-end",

    gap: 2,
  },

  amountInput: {
    ...TypeScale.title,

    color: Colors.paper,

    textAlign: "right",

    width: "100%",

    padding: 0,

    fontVariant: ["tabular-nums"],

    ...Platform.select({
      web: { outlineStyle: "solid" as const, outlineWidth: 0 },
    }),
  },

  error: {
    marginTop: Spacing.md,
  },

  flipRow: {
    alignItems: "center",

    marginVertical: -Spacing.sm,

    zIndex: 1,
  },

  flipButton: {
    width: 40,
    height: 40,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: Colors.surfaceAlt,

    borderWidth: 1,
    borderColor: Colors.borderStrong,

    borderRadius: Radius.full,
  },

  flipButtonPressed: {
    opacity: 0.7,
  },

  info: {
    marginTop: Spacing.xl,

    gap: Spacing.sm,
  },

  infoRow: {
    flexDirection: "row",

    alignItems: "center",

    justifyContent: "space-between",

    gap: Spacing.md,
  },
});
