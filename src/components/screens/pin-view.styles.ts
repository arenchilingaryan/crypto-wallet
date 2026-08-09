import { StyleSheet } from "react-native";

import { Colors, Radius, Spacing } from "@/constants/theme";

export const styles = StyleSheet.create({
  screen: {
    justifyContent: "center",
  },

  content: {
    gap: Spacing.md,
  },

  description: {
    marginBottom: Spacing.md,
  },

  input: {
    height: 56,

    paddingHorizontal: Spacing.lg,

    color: Colors.textPrimary,
    backgroundColor: Colors.surface,

    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,

    fontSize: 22,
    letterSpacing: 8,
    textAlign: "center",
  },

  button: {
    height: 52,
    marginTop: Spacing.sm,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: Colors.surfaceAlt,

    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
  },

  buttonPressed: {
    opacity: 0.65,
  },
});
