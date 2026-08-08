/**
 * Design tokens. The app is dark-only.
 *
 * Rules:
 * - Components consume semantic names (`Colors.surface`), never raw hex.
 * - Color carries meaning: green = gains, red = loss/danger, amber = caution.
 *   Everything else is neutral — the primary action is off-white on black.
 * - Text styles come from `TypeScale`; ad-hoc fontSize in screens is a smell.
 */

import { Platform, type TextStyle } from "react-native";

export const Colors = {
  background: "#0A0A0C",
  surface: "#141419",
  surfaceAlt: "#1C1C22",

  border: "#26262E",
  borderStrong: "#3B3B45",

  textPrimary: "#F2F2F5",
  textSecondary: "#9C9CA8",
  textMuted: "#616170",

  /** Primary action: off-white fill, near-black label. */
  action: "#F2F2F5",
  actionText: "#0C0C0E",

  success: "#4CC38A",
  danger: "#E5484D",
  warning: "#E2A336",
} as const;

export type ThemeColor = keyof typeof Colors;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 999,
} as const;

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    mono: "ui-monospace",
  },
  web: {
    sans: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    mono: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  },
  default: {
    sans: "sans-serif",
    mono: "monospace",
  },
});

export const TypeScale = {
  /** Hero numbers: the total balance. */
  display: { fontSize: 40, lineHeight: 46, fontWeight: "700", letterSpacing: -0.8 },
  /** Screen titles. */
  title: { fontSize: 26, lineHeight: 32, fontWeight: "700", letterSpacing: -0.4 },
  /** Section headings. */
  heading: { fontSize: 18, lineHeight: 24, fontWeight: "600", letterSpacing: -0.2 },
  body: { fontSize: 16, lineHeight: 22, fontWeight: "400" },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: "600" },
  /** Form labels, buttons on the small side. */
  label: { fontSize: 14, lineHeight: 20, fontWeight: "500" },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: "400" },
  /** Tiny uppercase kickers ("TOTAL BALANCE"). */
  overline: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "600",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
} as const satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof TypeScale;

/** Content column cap — keeps phone layouts on tablets and web. */
export const MaxContentWidth = 440;

export const ButtonHeight = 52;
