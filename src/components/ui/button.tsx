import {
  ActivityIndicator,
  Pressable,
  type ViewStyle,
} from "react-native";

import { Colors } from "@/constants/theme";
import { styles } from "./button.styles";
import { AppText } from "./text";

type ButtonVariant = "primary" | "secondary" | "ghost";

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
};

export function Button({
  title,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  style,
}: ButtonProps) {
  const inactive = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.base,
        variant === "primary" && styles.primary,
        variant === "secondary" && styles.secondary,
        pressed && variant === "primary" && styles.primaryPressed,
        pressed && variant !== "primary" && styles.mutedPressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "primary" ? Colors.actionText : Colors.textPrimary}
        />
      ) : (
        <AppText
          variant="bodyStrong"
          style={[
            styles.labelBase,
            variant === "primary" && styles.labelPrimary,
            variant === "ghost" && styles.labelGhost,
          ]}
        >
          {title}
        </AppText>
      )}
    </Pressable>
  );
}
