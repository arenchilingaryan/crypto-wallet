import { StyleSheet } from "react-native";

import { Colors, Radius } from "@/constants/theme";

export const styles = StyleSheet.create({
  container: {
    position: "relative",
    height: 180,
    width: "100%",
    overflow: "hidden",

    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  empty: {
    height: 180,
    width: "100%",

    alignItems: "center",
    justifyContent: "center",

    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  line: {
    position: "absolute",

    height: 2,

    backgroundColor: Colors.action,

    transformOrigin: "left center",
  },
});
