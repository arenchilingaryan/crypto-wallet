import { StyleSheet } from "react-native";

import { Colors, Radius, Spacing } from "@/constants/theme";

export const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",

    alignItems: "center",

    alignSelf: "flex-start",

    gap: Spacing.xs,

    paddingVertical: 3,
    paddingHorizontal: Spacing.sm,

    borderRadius: Radius.full,

    backgroundColor: Colors.surfaceAlt,
  },
});
