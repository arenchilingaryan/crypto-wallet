import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BackButton } from "./back-button";
import { styles } from "./screen.styles";

type ScreenProps = {
  children: ReactNode;

  scroll?: boolean;

  onBack?: () => void;
  style?: ViewStyle;
};

export function Screen({
  children,
  scroll = false,
  onBack,
  style,
}: ScreenProps) {
  const backRow = onBack ? (
    <View style={styles.backRow}>
      <BackButton onPress={onBack} />
    </View>
  ) : null;

  if (!scroll) {
    return (
      <SafeAreaView style={styles.safe}>
        {backRow}
        <View style={[styles.content, style]}>{children}</View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {backRow}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.scrollContent, style]}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
