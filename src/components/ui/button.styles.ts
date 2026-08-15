import { StyleSheet } from "react-native";

import { ButtonHeight, Colors, Radius, Spacing } from "@/constants/theme";

export const styles = StyleSheet.create({
  base: {
    height: ButtonHeight,
    // Full-width buttons never showed this, but a button inside a centred
    // container shrinks to its text — with no horizontal padding the label ends
    // up flush against the edges.
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  primary: {
    backgroundColor: Colors.action,
  },
  secondary: {
    borderWidth: 1,
    borderColor: Colors.borderStrong,
  },
  primaryPressed: {
    opacity: 0.85,
  },
  mutedPressed: {
    backgroundColor: Colors.surfaceAlt,
  },
  disabled: {
    opacity: 0.4,
  },
  labelBase: {
    color: Colors.textPrimary,
  },
  labelPrimary: {
    color: Colors.actionText,
  },
  labelGhost: {
    color: Colors.textSecondary,
  },
});
