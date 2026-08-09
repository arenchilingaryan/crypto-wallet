import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TextInput,
  View,
} from "react-native";

import { Screen } from "@/components/ui/screen";
import { AppText } from "@/components/ui/text";

import { styles } from "./pin-view.styles";

type PinViewProps = {
  mode: "setup" | "unlock" | "reauth";
  onSubmit: (pin: string) => Promise<string | null>;
};

export function PinView({ mode, onSubmit }: PinViewProps) {
  const [pin, setPin] = useState("");

  const [confirmation, setConfirmation] = useState("");

  const [error, setError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (pin.length !== 6) {
      setError("PIN must contain 6 digits");

      return;
    }

    if (mode === "setup" && pin !== confirmation) {
      setError("PIN codes do not match");

      return;
    }

    try {
      setLoading(true);
      setError(null);

      const result = await onSubmit(pin);

      if (result) {
        setError(result);
        setPin("");
        setConfirmation("");
      }
    } finally {
      setLoading(false);
    }
  }

  const title =
    mode === "setup"
      ? "Create PIN"
      : mode === "reauth"
        ? "Confirm transaction"
        : "Wallet locked";

  const description =
    mode === "setup"
      ? "Create a 6-digit PIN to protect access to your wallet."
      : mode === "reauth"
        ? "Enter your PIN to authorize this transaction."
        : "Enter your PIN to unlock the wallet.";

  const buttonLabel =
    mode === "setup"
      ? "Create PIN"
      : mode === "reauth"
        ? "Authorize"
        : "Unlock";

  return (
    <Screen style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.content}>
          <AppText variant="heading">{title}</AppText>

          <AppText variant="caption" tone="muted" style={styles.description}>
            {description}
          </AppText>

          <TextInput
            value={pin}
            onChangeText={(value) => {
              setPin(value.replace(/\D/g, ""));

              setError(null);
            }}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
            placeholder="PIN"
            placeholderTextColor="#66666D"
            style={styles.input}
          />

          {mode === "setup" && (
            <TextInput
              value={confirmation}
              onChangeText={(value) => {
                setConfirmation(value.replace(/\D/g, ""));

                setError(null);
              }}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
              placeholder="Confirm PIN"
              placeholderTextColor="#66666D"
              style={styles.input}
            />
          )}

          {error && (
            <AppText variant="caption" tone="danger">
              {error}
            </AppText>
          )}

          <Pressable
            disabled={loading}
            onPress={() => {
              void handleSubmit();
            }}
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
            ]}
          >
            <AppText variant="label">{buttonLabel}</AppText>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
