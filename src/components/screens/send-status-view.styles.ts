import { StyleSheet } from "react-native";

import { Colors, Radius, Spacing } from "@/constants/theme";

export const styles = StyleSheet.create({
  screen: {
    justifyContent: "center",
  },

  content: {
    gap: Spacing.lg,
  },

  message: {
    marginTop: Spacing.sm,
  },

  hash: {
    gap: Spacing.sm,

    padding: Spacing.lg,

    backgroundColor: Colors.surface,

    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
  },

  button: {
    minHeight: 52,

    marginTop: Spacing.lg,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: Colors.surfaceAlt,

    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
  },

  pressed: {
    opacity: 0.65,
  },
});
