import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { PinView } from "@/components/screens/pin-view";
import { Colors } from "@/constants/theme";
import { securityApi } from "@/platform/react-native/securityApi";
import { walletApi } from "@/platform/react-native/walletApi";

type SecurityState = "checking" | "open" | "setup" | "locked" | "unlocked";

export default function RootLayout() {
  const [securityState, setSecurityState] = useState<SecurityState>("checking");

  useEffect(() => {
    void bootstrapSecurity();

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );

    return () => {
      subscription.remove();
    };
  }, []);

  async function bootstrapSecurity() {
    try {
      const [wallets, pinConfigured] = await Promise.all([
        walletApi.list(),
        securityApi.hasPin(),
      ]);

      if (wallets.length === 0) {
        setSecurityState("open");
        return;
      }

      if (!pinConfigured) {
        setSecurityState("setup");
        return;
      }

      securityApi.lock();

      setSecurityState("locked");
    } catch (error) {
      console.error("Security bootstrap failed:", error);

      setSecurityState("locked");
    }
  }

  async function handleAppStateChange(nextState: AppStateStatus) {
    if (nextState === "active") {
      return;
    }

    try {
      const [wallets, pinConfigured] = await Promise.all([
        walletApi.list(),
        securityApi.hasPin(),
      ]);

      if (wallets.length === 0) {
        return;
      }

      if (!pinConfigured) {
        setSecurityState("setup");
        return;
      }

      securityApi.lock();

      setSecurityState("locked");
    } catch (error) {
      console.error("Auto-lock failed:", error);
    }
  }

  if (securityState === "checking") {
    return null;
  }

  if (securityState === "setup") {
    return (
      <>
        <StatusBar style="light" />

        <PinView
          mode="setup"
          onSubmit={async (pin) => {
            try {
              await securityApi.setupPin(pin);

              setSecurityState("unlocked");

              return null;
            } catch (error) {
              console.error("PIN setup failed:", error);

              return "Failed to create PIN";
            }
          }}
        />
      </>
    );
  }

  if (securityState === "locked") {
    return (
      <>
        <StatusBar style="light" />

        <PinView
          mode="unlock"
          onSubmit={async (pin) => {
            try {
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
            } catch (error) {
              console.error("PIN unlock failed:", error);

              return "Failed to unlock wallet";
            }
          }}
        />
      </>
    );
  }

  return (
    <>
      <StatusBar style="light" />

      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: Colors.background,
          },
        }}
      />
    </>
  );
}
