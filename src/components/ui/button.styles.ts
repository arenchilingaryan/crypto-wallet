import { StyleSheet } from "react-native";

import { ButtonHeight, Colors, Radius } from "@/constants/theme";

export const styles = StyleSheet.create({
  base: {
    height: ButtonHeight,
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
