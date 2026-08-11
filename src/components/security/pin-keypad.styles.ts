import { StyleSheet } from "react-native";

import { Colors, Radius, Spacing } from "@/constants/theme";

export const styles = StyleSheet.create({
  keypad: {
    alignItems: "center",
    gap: Spacing.md,
  },

  row: {
    flexDirection: "row",
    gap: Spacing.lg,
  },

  key: {
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  deleteKey: {
    backgroundColor: Colors.surfaceAlt,
  },

  keyPlaceholder: {
    width: 72,
    height: 72,
  },

  keyPressed: {
    opacity: 0.55,
    transform: [
      {
        scale: 0.96,
      },
    ],
  },

  disabled: {
    opacity: 0.4,
  },
});
