import { StyleSheet } from "react-native";

import { Colors, Radius, Spacing } from "@/constants/theme";

export const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  pressed: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.sm,
    opacity: 0.65,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logo: {
    width: "100%",
    height: "100%",
  },
  initials: {
    fontWeight: "600",
  },
  name: {
    flex: 1,
    gap: 2,
  },
  amounts: {
    alignItems: "flex-end",
    gap: 2,
  },

  valueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
});
