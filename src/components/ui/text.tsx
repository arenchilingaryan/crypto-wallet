import { Text, type TextProps } from "react-native";

import {
  Colors,
  Fonts,
  TypeScale,
  type TypeVariant,
} from "@/constants/theme";

type Tone =
  | "primary"
  | "secondary"
  | "muted"
  | "paper"
  | "accent"
  | "success"
  | "danger"
  | "warning";

const toneColor: Record<Tone, string> = {
  primary: Colors.textPrimary,
  secondary: Colors.textSecondary,
  muted: Colors.textMuted,
  paper: Colors.paper,
  accent: Colors.accent,
  success: Colors.success,
  danger: Colors.danger,
  warning: Colors.warning,
};

export type AppTextProps = TextProps & {
  variant?: TypeVariant;
  tone?: Tone;
  /** Monospace — addresses, seed words, raw values. */
  mono?: boolean;
  /** Tabular figures — anything numeric that may reflow. */
  tabular?: boolean;
};

export function AppText({
  variant = "body",
  tone = "primary",
  mono = false,
  tabular = false,
  style,
  ...rest
}: AppTextProps) {
  return (
    <Text
      style={[
        TypeScale[variant],
        { color: toneColor[tone] },
        mono && { fontFamily: Fonts.mono, letterSpacing: 0.2 },
        tabular && { fontVariant: ["tabular-nums"] },
        style,
      ]}
      {...rest}
    />
  );
}
