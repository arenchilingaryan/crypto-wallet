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

  paper: "#FFFCF0",

  accent: "#3AA99F",

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
  display: {
    fontSize: 40,
    lineHeight: 46,
    fontWeight: "700",
    letterSpacing: -0.8,
  },

  title: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "700",
    letterSpacing: -0.4,
  },

  heading: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  body: { fontSize: 16, lineHeight: 22, fontWeight: "400" },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: "600" },

  label: { fontSize: 14, lineHeight: 20, fontWeight: "500" },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: "400" },

  overline: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "600",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
} as const satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof TypeScale;

export const MaxContentWidth = 440;

export const ButtonHeight = 52;
