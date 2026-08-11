import { useEffect, useState } from "react";

import { useRouter } from "expo-router";

import { ActivityIndicator } from "react-native";

import { PinView } from "@/components/screens/pin-view";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/ui/footer";
import { Screen } from "@/components/ui/screen";
import { ScreenHeader } from "@/components/ui/screen-header";

import { Colors } from "@/constants/theme";

import { securityApi } from "@/platform/react-native/securityApi";

type Step = "loading" | "verify" | "create" | "done";

export default function ChangePinScreen() {
  const router = useRouter();

  const [step, setStep] = useState<Step>("loading");

  useEffect(() => {
    let mounted = true;

    void securityApi.hasPin().then((configured) => {
      if (!mounted) {
        return;
      }

      // Кошельки без PIN сразу попадают на создание —
      // подтверждать им нечего.
      setStep(configured ? "verify" : "create");
    });

    return () => {
      mounted = false;
    };
  }, []);

  if (step === "loading") {
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

  if (step === "verify") {
    return (
      <PinView
        // key ремаунтит PinView между шагами: без него React переиспользует
        // инстанс, и введённый здесь PIN остаётся в состоянии setup-шага.
        key="verify"
        mode="verify"
        onCancel={() => {
          router.back();
        }}
        onSubmit={async (pin) => {
          const result = await securityApi.verifyCurrentPin(pin);

          if (!result.ok) {
            if (result.reason === "locked") {
              return `Too many attempts. Try again in ${Math.ceil(
                result.retryAfterMs / 1000,
              )}s.`;
            }

            return `Wrong PIN. ${result.attemptsLeft} attempts left.`;
          }

          setStep("create");

          return null;
        }}
      />
    );
  }

  if (step === "create") {
    return (
      <PinView
        key="create"
        mode="setup"
        onCancel={() => {
          router.back();
        }}
        onSubmit={async (pin) => {
          try {
            await securityApi.setupPin(pin);
          } catch (setupError) {
            console.error("PIN update failed:", setupError);

            return "Failed to update PIN";
          }

          setStep("done");

          return null;
        }}
      />
    );
  }

  return (
    <Screen>
      <ScreenHeader
        title="PIN updated"
        subtitle="Use your new PIN to unlock the wallet and confirm transactions."
      />

      <Footer>
        <Button
          title="Done"
          onPress={() => {
            router.back();
          }}
        />
      </Footer>
    </Screen>
  );
}
