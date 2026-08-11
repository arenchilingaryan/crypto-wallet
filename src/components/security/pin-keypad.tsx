import { Pressable, View } from "react-native";

import { AppText } from "@/components/ui/text";

import { styles } from "./pin-keypad.styles";

type PinKeypadProps = {
  onDigit: (digit: string) => void;
  onDelete: () => void;
  disabled?: boolean;
};

const rows = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
] as const;

export function PinKeypad({
  onDigit,
  onDelete,
  disabled = false,
}: PinKeypadProps) {
  return (
    <View style={styles.keypad}>
      {rows.map((row) => (
        <View key={row.join("")} style={styles.row}>
          {row.map((digit) => (
            <Pressable
              key={digit}
              accessibilityRole="button"
              accessibilityLabel={digit}
              disabled={disabled}
              onPress={() => onDigit(digit)}
              style={({ pressed }) => [
                styles.key,
                pressed && styles.keyPressed,
                disabled && styles.disabled,
              ]}
            >
              <AppText variant="heading">{digit}</AppText>
            </Pressable>
          ))}
        </View>
      ))}

      <View style={styles.row}>
        <View style={styles.keyPlaceholder} />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="0"
          disabled={disabled}
          onPress={() => onDigit("0")}
          style={({ pressed }) => [
            styles.key,
            pressed && styles.keyPressed,
            disabled && styles.disabled,
          ]}
        >
          <AppText variant="heading">0</AppText>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete"
          disabled={disabled}
          onPress={onDelete}
          style={({ pressed }) => [
            styles.key,
            styles.deleteKey,
            pressed && styles.keyPressed,
            disabled && styles.disabled,
          ]}
        >
          <AppText variant="heading">⌫</AppText>
        </Pressable>
      </View>
    </View>
  );
}
