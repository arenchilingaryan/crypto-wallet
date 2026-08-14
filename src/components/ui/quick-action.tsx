import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { styles } from "./quick-action.styles";
import { AppText } from "./text";

type QuickActionProps = {
  label: string;

  icon: ReactNode;

  disabled?: boolean;

  onPress: () => void;
};

export function QuickAction({
  label,
  icon,
  disabled = false,
  onPress,
}: QuickActionProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.action, disabled && styles.disabled]}
    >
      {({ pressed }) => (
        <>
          <View style={[styles.circle, pressed && styles.circlePressed]}>
            {icon}
          </View>

          <AppText variant="caption" tone="secondary">
            {label}
          </AppText>
        </>
      )}
    </Pressable>
  );
}
