import { StyleSheet } from "react-native";

import { Colors, MaxContentWidth, Radius, Spacing } from "@/constants/theme";

export const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background,

    paddingTop: Spacing.sm,

    paddingHorizontal: Spacing.xl,

    alignItems: "center",
  },

  dock: {
    flexDirection: "row",

    alignItems: "center",

    width: "100%",

    maxWidth: MaxContentWidth - Spacing.xl * 2,

    backgroundColor: Colors.surface,

    borderWidth: 1,
    borderColor: Colors.border,

    borderRadius: Radius.full,

    padding: Spacing.xs,

    gap: Spacing.xs,
  },

  item: {
    flexGrow: 1,

    // Нулевой basis: ширины распределяет только flexGrow,
    // а не длина содержимого.
    flexBasis: 0,

    flexDirection: "row",

    alignItems: "center",
    justifyContent: "center",

    gap: 6,

    height: 44,

    borderRadius: Radius.full,

    paddingHorizontal: Spacing.sm,
  },

  itemActive: {
    backgroundColor: Colors.surfaceAlt,

    // Активной пилюле с подписью нужно больше места, чем иконкам.
    flexGrow: 2,

    paddingHorizontal: Spacing.lg,
  },

  itemPressed: {
    opacity: 0.7,
  },
});
