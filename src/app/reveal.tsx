import { useEffect, useRef, useState } from "react";

import { ActivityIndicator } from "react-native";


import { goBack } from "@/utils/navigation";

import { PinView } from "@/components/screens/pin-view";
import { RevealSecretView } from "@/components/screens/reveal-secret-view";
import { Screen } from "@/components/ui/screen";
import { AppText } from "@/components/ui/text";

import { Colors } from "@/constants/theme";

import { describePinFailure } from "@/core/security/pin";
import type { RevealedSecret } from "@/core/wallet/revealSecret";

import { securityApi } from "@/platform/react-native/securityApi";
import { startTimingRun } from "@/platform/react-native/timings";
import { walletApi } from "@/platform/react-native/walletApi";

export default function RevealScreen() {  const [pinConfigured, setPinConfigured] = useState<boolean | null>(null);

  const [secret, setSecret] = useState<RevealedSecret | null>(null);

  const [error, setError] = useState<string | null>(null);

  const revealTiming = useRef<ReturnType<typeof startTimingRun> | null>(null);

  useEffect(() => {
    void securityApi.hasPin().then(setPinConfigured);
  }, []);

  useEffect(() => {
    if (!secret || !revealTiming.current) {
      return;
    }

    revealTiming.current.step("render");

    revealTiming.current.finish();

    revealTiming.current = null;
  }, [secret]);

  if (pinConfigured === null) {
    return (
      <Screen>
        <ActivityIndicator color={Colors.textSecondary} />
      </Screen>
    );
  }

  if (secret) {
    return (
      <RevealSecretView
        secret={secret}
        onBack={() => {
          setSecret(null);

          goBack("/settings");
        }}
      />
    );
  }

  if (error) {
    return (
      <Screen
        onBack={() => {
          goBack("/settings");
        }}
      >
        <AppText variant="bodyStrong" tone="danger">
          {error}
        </AppText>
      </Screen>
    );
  }

  return (
    <PinView
      mode={pinConfigured ? "verify" : "setup"}
      onCancel={() => {
        goBack("/settings");
      }}
      onSubmit={async (pin) => {
        const timing = startTimingRun("reveal");

        try {
          if (pinConfigured) {
            const result = await securityApi.verifyCurrentPin(pin, timing);

            if (!result.ok) {
              timing.finish();

              return describePinFailure(result);
            }
          } else {
            await securityApi.setupPin(pin);

            timing.step("setup");

            setPinConfigured(true);
          }

          const revealed = await walletApi.reveal();

          timing.step("read");

          revealTiming.current = timing;

          setSecret(revealed);

          return null;
        } catch (revealError) {
          timing.finish();

          console.error("Revealing the recovery phrase failed:", revealError);

          setError(
            revealError instanceof Error
              ? revealError.message
              : "Could not read this wallet",
          );

          return null;
        }
      }}
    />
  );
}
