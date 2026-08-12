/**
 * Design tokens. The app is dark-only.
 *
 * Palette concept — "ink & paper, annotated by a machine":
 * - The base is warm ink (brown-black), not the usual cool fintech gray.
 * - Human text is warm paper tones; the brightest ivory (`paper`) is reserved
 *   for the money numbers and screen titles.
 * - Machine text — addresses, seed-word indices, anything mono — gets the one
 *   cool note in the system: muted teal (`accent`). Warm vs cool is the
 *   contrast that makes the theme read as designed, without gradients.
 * - Semantics stay semantic: olive-green = gains, brick-red = loss/danger,
 *   mustard = caution. The primary action is paper on ink.
 * - Components consume semantic names (`Colors.surface`), never raw hex.
 * - Text styles come from `TypeScale`; ad-hoc fontSize in screens is a smell.
 */

import { Platform, type TextStyle } from "react-native";

export const Colors = {
  background: "#100F0E",
  surface: "#1B1917",
  surfaceAlt: "#252320",

  border: "#2E2B27",
  borderStrong: "#474337",

  textPrimary: "#D8D5CB",
  textSecondary: "#9C998E",
  textMuted: "#6C695F",

  /** Brightest ivory — display numbers and titles only. */
  paper: "#FFFCF0",

  /** The single cool note — machine text: addresses, indices, mono details. */
  accent: "#3AA99F",

  /** Primary action: paper fill, ink label. */
  action: "#F1EFE2",
  actionText: "#12110F",

  success: "#A0AF54",
  danger: "#D14D41",
  warning: "#D0A215",
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
  xl: 24,
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
  display: {
    fontSize: 40,
    lineHeight: 46,
    fontWeight: "700",
    letterSpacing: -0.8,
  },
  /** Screen titles. */
  title: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  /** Section headings. */
  heading: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
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
