import { useEffect, useState } from "react";

import { ActivityIndicator, AppState } from "react-native";

import { Stack } from "expo-router";

import { PinView } from "@/components/screens/pin-view";
import { Screen } from "@/components/ui/screen";

import { Colors } from "@/constants/theme";

import { securityApi } from "@/platform/react-native/securityApi";

type SecurityState = "loading" | "unlocked" | "locked";

export default function RootLayout() {
  const [securityState, setSecurityState] = useState<SecurityState>("loading");

  useEffect(() => {
    let mounted = true;

    void (async () => {
      const configured = await securityApi.hasPin();

      if (!mounted) {
        return;
      }

      if (!configured) {
        await securityApi.unlockWhenNoPin();

        if (!mounted) {
          return;
        }

        setSecurityState("unlocked");
        return;
      }

      securityApi.lock();

      setSecurityState("locked");
    })();

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        return;
      }

      void (async () => {
        const configured = await securityApi.hasPin();

        if (!mounted || !configured) {
          return;
        }

        securityApi.lock();

        setSecurityState("locked");
      })();
    });

    return () => {
      mounted = false;

      subscription.remove();
    };
  }, []);

  if (securityState === "loading") {
    return (
      <Screen
        style={{
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={Colors.textSecondary} />
      </Screen>
    );
  }

  if (securityState === "locked") {
    return (
      <PinView
        mode="unlock"
        onSubmit={async (pin) => {
          const result = await securityApi.unlock(pin);

          if (result.ok) {
            setSecurityState("unlocked");

            return null;
          }

          if (result.reason === "locked") {
            return `Too many attempts. Try again in ${Math.ceil(
              result.retryAfterMs / 1000,
            )}s.`;
          }

          return `Wrong PIN. ${result.attemptsLeft} attempts left.`;
        }}
      />
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="(tabs)" />

      <Stack.Screen name="onboarding" />

      <Stack.Screen name="search" />

      <Stack.Screen name="asset/[id]" />

      <Stack.Screen name="receive/[id]" />

      <Stack.Screen name="swap" />

      <Stack.Screen name="send/index" />

      <Stack.Screen name="send/native" />

      <Stack.Screen name="send/erc20" />

      <Stack.Screen name="wallets" />

      <Stack.Screen name="settings" />

      <Stack.Screen name="change-pin" />

      <Stack.Screen name="activity/[hash]" />
    </Stack>
  );
}
