import { StyleSheet } from "react-native";

import { Colors, Radius, Spacing } from "@/constants/theme";

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
  },

  tokenSelectorPressed: {
    opacity: 0.7,
  },

  tokenName: {
    gap: 2,
  },

  amount: {
    alignItems: "flex-end",

    gap: 2,

    flexShrink: 1,
  },

  // Кнопка-переворот между картами; слегка наезжает на обе.
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
