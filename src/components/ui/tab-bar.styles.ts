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

  // flexGrow анимируется (1 → 2 для активной вкладки).
  item: {
    flexGrow: 1,

    flexBasis: 0,

    height: 44,

    borderRadius: Radius.full,

    overflow: "hidden",
  },

  itemPressable: {
    flex: 1,

    flexDirection: "row",

    alignItems: "center",
    justifyContent: "center",

    gap: 6,

    paddingHorizontal: Spacing.sm,
  },

  // Подложка активной пилюли; появляется через opacity.
  itemPill: {
    ...StyleSheet.absoluteFillObject,

    borderRadius: Radius.full,

    backgroundColor: Colors.surfaceAlt,
  },

  itemPressed: {
    opacity: 0.7,
  },
});
