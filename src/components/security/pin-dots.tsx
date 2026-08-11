import { StyleSheet, View } from "react-native";

import { Colors, Spacing } from "@/constants/theme";

type PinDotsProps = {
  length: number;
  active?: boolean;
};

const PIN_LENGTH = 6;

export function PinDots({ length, active = true }: PinDotsProps) {
  return (
    <View style={[styles.container, !active && styles.inactive]}>
      {Array.from({ length: PIN_LENGTH }).map((_, index) => (
        <View
          key={index}
          style={[styles.dot, index < length && styles.filled]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
  },

  inactive: {
    opacity: 0.4,
  },

  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: Colors.textPrimary,
  },

  filled: {
    backgroundColor: Colors.textPrimary,
  },
});
