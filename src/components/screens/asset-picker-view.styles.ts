import { Platform, StyleSheet } from "react-native";

import { Colors, Radius, Spacing } from "@/constants/theme";

export const styles = StyleSheet.create({
  screen: {
    gap: Spacing.lg,
  },

  header: {
    gap: Spacing.md,
  },

  backButton: {
    alignSelf: "flex-start",

    paddingVertical: Spacing.sm,

    paddingHorizontal: Spacing.md,

    borderWidth: 1,
    borderColor: Colors.border,

    borderRadius: Radius.full,

    backgroundColor: Colors.surface,
  },

  searchBox: {
    height: 52,

    flexDirection: "row",
    alignItems: "center",

    gap: Spacing.sm,

    paddingHorizontal: Spacing.md,

    borderWidth: 1,
    borderColor: Colors.border,

    borderRadius: Radius.md,

    backgroundColor: Colors.surface,
  },

  // Без собственной высоты: строка ввода принимает высоту текста, а по
  // вертикали её центрирует searchBox. Растянутый на всю высоту инпут
  // прижимал плейсхолдер к верху (у RN нет вертикального центрирования
  // текста внутри инпута фиксированной высоты).
  searchInput: {
    flex: 1,

    padding: 0,

    color: Colors.textPrimary,

    fontSize: 16,

    lineHeight: 20,

    textAlignVertical: "center",

    includeFontPadding: false,

    ...Platform.select({
      web: { outlineStyle: "solid" as const, outlineWidth: 0 },
    }),
  },

  loading: {
    flexDirection: "row",
    alignItems: "center",

    gap: Spacing.sm,
  },

  empty: {
    gap: Spacing.xs,

    paddingVertical: Spacing.xl,
  },

  list: {
    gap: Spacing.sm,
  },

  asset: {
    minHeight: 76,

    flexDirection: "row",

    alignItems: "center",
    justifyContent: "space-between",

    gap: Spacing.md,

    padding: Spacing.md,

    borderWidth: 1,
    borderColor: Colors.border,

    borderRadius: Radius.md,

    backgroundColor: Colors.surface,
  },

  assetIdentity: {
    flex: 1,

    flexDirection: "row",
    alignItems: "center",

    gap: Spacing.md,
  },

  icon: {
    width: 42,
    height: 42,

    alignItems: "center",
    justifyContent: "center",

    borderRadius: Radius.full,

    backgroundColor: Colors.surfaceAlt,
  },

  assetText: {
    flex: 1,
    gap: 2,
  },

  assetTitle: {
    flexDirection: "row",
    alignItems: "center",

    gap: Spacing.sm,
  },

  pressed: {
    opacity: 0.65,
  },
});
