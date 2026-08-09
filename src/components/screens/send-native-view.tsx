import { Pressable, TextInput, View } from "react-native";

import { Screen } from "@/components/ui/screen";
import { AppText } from "@/components/ui/text";

import { styles } from "./send-native-view.styles";

type SendNativeViewProps = {
  to: string;
  amount: string;

  error: string | null;
  loading: boolean;

  onChangeTo: (value: string) => void;

  onChangeAmount: (value: string) => void;

  onContinue: () => void;
  onBack: () => void;
};

export function SendNativeView({
  to,
  amount,
  error,
  loading,

  onChangeTo,
  onChangeAmount,

  onContinue,
  onBack,
}: SendNativeViewProps) {
  return (
    <Screen>
      <View style={styles.header}>
        <Pressable
          onPress={onBack}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}
        >
          <AppText variant="label">Back</AppText>
        </Pressable>

        <AppText variant="heading">Send ETH</AppText>
      </View>

      <View style={styles.form}>
        <View style={styles.field}>
          <AppText variant="caption" tone="muted">
            Recipient
          </AppText>

          <TextInput
            value={to}
            onChangeText={onChangeTo}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="0x..."
            placeholderTextColor="#66666D"
            style={styles.input}
          />
        </View>

        <View style={styles.field}>
          <AppText variant="caption" tone="muted">
            Amount
          </AppText>

          <TextInput
            value={amount}
            onChangeText={onChangeAmount}
            keyboardType="decimal-pad"
            placeholder="0.0"
            placeholderTextColor="#66666D"
            style={styles.input}
          />

          <AppText variant="caption" tone="muted">
            ETH
          </AppText>
        </View>

        {error && (
          <AppText variant="caption" tone="danger">
            {error}
          </AppText>
        )}

        <Pressable
          disabled={loading}
          onPress={onContinue}
          style={({ pressed }) => [
            styles.continueButton,
            pressed && styles.pressed,
            loading && styles.disabled,
          ]}
        >
          <AppText variant="label">
            {loading ? "Preparing…" : "Continue"}
          </AppText>
        </Pressable>
      </View>
    </Screen>
  );
}
