import { useState } from "react";
import { TextInput, View, type TextInputProps } from "react-native";

import { Colors } from "@/constants/theme";
import { styles } from "./input.styles";
import { AppText } from "./text";

type InputProps = TextInputProps & {
  label?: string;
  error?: string | null;

  mono?: boolean;
};

export function Input({ label, error, mono = false, style, ...rest }: InputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.field}>
      {label && (
        <AppText variant="label" tone="secondary">
          {label}
        </AppText>
      )}

      <TextInput
        placeholderTextColor={Colors.textMuted}
        cursorColor={Colors.textPrimary}
        selectionColor={Colors.borderStrong}
        keyboardAppearance="dark"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          styles.input,
          mono && styles.mono,
          focused && styles.focused,
          error != null && styles.errored,
          style,
        ]}
        {...rest}
      />

      {error != null && (
        <AppText variant="caption" tone="danger">
          {error}
        </AppText>
      )}
    </View>
  );
}
