import { useEffect, useRef, useState } from "react";

import { ActivityIndicator, AppState, View } from "react-native";

import { Stack } from "expo-router";

import { TimingNotice } from "@/components/dev/timing-notice";
import { PinView } from "@/components/screens/pin-view";
import { Screen } from "@/components/ui/screen";

import { Colors } from "@/constants/theme";

import { bootstrapCore } from "@/platform/react-native/bootstrapCore";
import { walletEngine } from "@/platform/react-native/compositionRoot";
import { describePinFailure } from "@/core/security/pin";

import { outflowGuardApi } from "@/platform/react-native/outflowGuardApi";
import { securityApi } from "@/platform/react-native/securityApi";
import { startTimingRun } from "@/platform/react-native/timings";

bootstrapCore();

type TimingRunHandle = ReturnType<typeof startTimingRun>;

type SecurityState = "loading" | "unlocked" | "locked";

export default function RootLayout() {
  const [securityState, setSecurityState] = useState<SecurityState>("loading");

  const unlockTiming = useRef<TimingRunHandle | null>(null);

  useEffect(() => {
    if (securityState !== "unlocked" || !unlockTiming.current) {
      return;
    }

    unlockTiming.current.step("render");

    unlockTiming.current.finish();

    unlockTiming.current = null;
  }, [securityState]);

  useEffect(() => {
    let mounted = true;

    void (async () => {
      const reconciliation = await walletEngine.initialize();

      await outflowGuardApi.reconcile().catch((error: unknown) => {
        console.error("Outflow reservations could not be reconciled:", error);
      });

      if (reconciliation.status === "degraded") {
        console.error("Wallet storage could not be read at startup");
      }

      if (reconciliation.repaired.length > 0) {
        console.warn(
          `Wallet state was repaired at startup: ${reconciliation.repaired.join("; ")}`,
        );
      }

      if (reconciliation.walletsWithoutSecret.length > 0) {
        console.warn(
          `Wallets without a stored recovery phrase: ${reconciliation.walletsWithoutSecret.join(", ")}`,
        );
      }

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
      <View style={{ flex: 1 }}>
        <PinView
          mode="unlock"
          onSubmit={async (pin) => {
            const timing = startTimingRun("unlock");

            const result = await securityApi.unlock(pin, timing);

            if (result.ok) {
              unlockTiming.current = timing;

              setSecurityState("unlocked");

              return null;
            }

            timing.finish();

            return describePinFailure(result);
          }}
        />

        <TimingNotice />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
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

        <Stack.Screen name="limits" />

        <Stack.Screen name="reveal" />

        <Stack.Screen name="repair" />

        <Stack.Screen name="activity/[hash]" />
      </Stack>

      <TimingNotice />
    </View>
  );
}
