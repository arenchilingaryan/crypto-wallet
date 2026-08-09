import { StyleSheet } from "react-native";

import { Colors, Radius } from "@/constants/theme";

export const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    backgroundColor: Colors.surfaceAlt,
  },
});
