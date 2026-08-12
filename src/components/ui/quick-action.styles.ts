import { StyleSheet } from "react-native";

import { Colors, Radius, Spacing } from "@/constants/theme";

export const styles = StyleSheet.create({
  action: {
    flex: 1,

    alignItems: "center",

    gap: Spacing.sm,
  },

  circle: {
    width: 56,
    height: 56,

    alignItems: "center",
    justifyContent: "center",

    borderWidth: 1,
    borderColor: Colors.border,

    borderRadius: Radius.full,

    backgroundColor: Colors.surface,
  },

  circlePressed: {
    backgroundColor: Colors.surfaceAlt,
  },

  disabled: {
    opacity: 0.4,
  },
});
