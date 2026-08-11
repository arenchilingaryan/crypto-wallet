import { StyleSheet } from "react-native";

import { Spacing } from "@/constants/theme";

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },

  content: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.xl,
  },

  header: {
    width: "100%",
    alignItems: "center",
    gap: Spacing.sm,
  },

  description: {
    maxWidth: 320,
    textAlign: "center",
  },

  pinArea: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xl,
  },

  pinBlock: {
    alignItems: "center",
    gap: Spacing.md,
  },

  inactivePinBlock: {
    opacity: 0.6,
  },

  errorContainer: {
    minHeight: 24,
    alignItems: "center",
    justifyContent: "center",
  },

  error: {
    textAlign: "center",
  },

  cancelButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.lg,
  },

  cancelButtonPressed: {
    opacity: 0.55,
  },
});
