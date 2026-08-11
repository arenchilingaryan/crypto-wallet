import { useState } from "react";

import { Pressable, View } from "react-native";

import { PinDots } from "@/components/security/pin-dots";
import { PinKeypad } from "@/components/security/pin-keypad";
import { Screen } from "@/components/ui/screen";
import { AppText } from "@/components/ui/text";

import { styles } from "./pin-view.styles";

type PinViewProps = {
  mode: "setup" | "unlock" | "reauth" | "verify";
  onSubmit: (pin: string) => Promise<string | null>;
  onCancel?: () => void;
};

type SetupStep = "create" | "confirm";

const PIN_LENGTH = 6;

export function PinView({ mode, onSubmit, onCancel }: PinViewProps) {
  const [pin, setPin] = useState("");

  const [confirmation, setConfirmation] = useState("");

  const [setupStep, setSetupStep] = useState<SetupStep>("create");

  const [error, setError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);

  async function submitPin(value: string) {
    if (loading) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const result = await onSubmit(value);

      if (!result) {
        return;
      }

      setError(result);

      if (mode === "setup") {
        setConfirmation("");
        setSetupStep("confirm");
        return;
      }

      setPin("");
    } finally {
      setLoading(false);
    }
  }

  function handleDigit(digit: string) {
    if (loading) {
      return;
    }

    setError(null);

    if (mode === "setup") {
      if (setupStep === "create") {
        if (pin.length >= PIN_LENGTH) {
          return;
        }

        const next = pin + digit;

        setPin(next);

        if (next.length === PIN_LENGTH) {
          setSetupStep("confirm");
        }

        return;
      }

      if (confirmation.length >= PIN_LENGTH) {
        return;
      }

      const next = confirmation + digit;

      setConfirmation(next);

      if (next.length !== PIN_LENGTH) {
        return;
      }

      if (next !== pin) {
        setError("PIN codes do not match");

        setConfirmation("");

        return;
      }

      void submitPin(pin);

      return;
    }

    if (pin.length >= PIN_LENGTH) {
      return;
    }

    const next = pin + digit;

    setPin(next);

    if (next.length === PIN_LENGTH) {
      void submitPin(next);
    }
  }

  function handleDelete() {
    if (loading) {
      return;
    }

    setError(null);

    if (mode === "setup" && setupStep === "confirm") {
      if (confirmation.length > 0) {
        setConfirmation((value) => value.slice(0, -1));

        return;
      }

      setSetupStep("create");

      setPin((value) => value.slice(0, -1));

      return;
    }

    setPin((value) => value.slice(0, -1));
  }

  const title =
    mode === "setup"
      ? "Create PIN"
      : mode === "reauth"
        ? "Confirm transaction"
        : mode === "verify"
          ? "Enter current PIN"
          : "Wallet locked";

  const description =
    mode === "setup"
      ? "Create a 6-digit PIN to protect access to your wallet."
      : mode === "reauth"
        ? "Enter your PIN to authorize this transaction."
        : mode === "verify"
          ? "Confirm your current PIN to continue."
          : "Enter your PIN to unlock the wallet.";

  return (
    <Screen style={styles.screen}>
      <View style={styles.content}>
        <View style={styles.header}>
          <AppText variant="heading">{title}</AppText>

          <AppText variant="caption" tone="muted" style={styles.description}>
            {description}
          </AppText>
        </View>

        <View style={styles.pinArea}>
          {mode === "setup" ? (
            <>
              <View
                style={[
                  styles.pinBlock,
                  setupStep !== "create" && styles.inactivePinBlock,
                ]}
              >
                <AppText
                  variant="label"
                  tone={setupStep === "create" ? undefined : "muted"}
                >
                  Create PIN
                </AppText>

                <PinDots length={pin.length} active={setupStep === "create"} />
              </View>

              <View
                style={[
                  styles.pinBlock,
                  setupStep !== "confirm" && styles.inactivePinBlock,
                ]}
              >
                <AppText
                  variant="label"
                  tone={setupStep === "confirm" ? undefined : "muted"}
                >
                  Confirm PIN
                </AppText>

                <PinDots
                  length={confirmation.length}
                  active={setupStep === "confirm"}
                />
              </View>
            </>
          ) : (
            <View style={styles.pinBlock}>
              <PinDots length={pin.length} />
            </View>
          )}

          <View style={styles.errorContainer}>
            {error && (
              <AppText variant="caption" tone="danger" style={styles.error}>
                {error}
              </AppText>
            )}
          </View>
        </View>
        {onCancel && (
          <Pressable
            disabled={loading}
            onPress={onCancel}
            style={({ pressed }) => [
              styles.cancelButton,
              pressed && styles.cancelButtonPressed,
            ]}
          >
            <AppText variant="label" tone="muted">
              Cancel
            </AppText>
          </Pressable>
        )}

        <PinKeypad
          disabled={loading}
          onDigit={handleDigit}
          onDelete={handleDelete}
        />
      </View>
    </Screen>
  );
}
