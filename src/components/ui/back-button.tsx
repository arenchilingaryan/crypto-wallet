import Feather from "@expo/vector-icons/Feather";
import { Pressable } from "react-native";

import { Colors } from "@/constants/theme";
import { styles } from "./back-button.styles";

type BackButtonProps = {
  onPress: () => void;
};

export function BackButton({ onPress }: BackButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Feather name="arrow-left" size={18} color={Colors.textPrimary} />
    </Pressable>
  );
}
