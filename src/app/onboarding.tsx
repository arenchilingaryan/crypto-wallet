import { useEffect, useState } from "react";

import { useRouter } from "expo-router";

import { OnboardingView } from "@/components/screens/onboarding-view";
import { PhraseView } from "@/components/screens/phrase-view";
import { PinView } from "@/components/screens/pin-view";
import { RestoreView } from "@/components/screens/restore-view";
import { VerifyView } from "@/components/screens/verify-view";
import { Screen } from "@/components/ui/screen";

import { Colors } from "@/constants/theme";

import { securityApi } from "@/platform/react-native/securityApi";
import { walletApi } from "@/platform/react-native/walletApi";

import { ActivityIndicator } from "react-native";
import type { Address } from "viem";

type WalletState =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "importing" }
  | {
      status: "generated";
      address: Address;
      mnemonic: string;
    }
  | {
      status: "confirming";
      address: Address;
      mnemonic: string;
    }
  | {
      status: "securitySetup";
      address: Address;
    };

export default function OnboardingScreen() {
  const router = useRouter();

  const [walletState, setWalletState] = useState<WalletState>({
    status: "loading",
  });

  const [importMnemonic, setImportMnemonic] = useState("");
  const [importError, setImportError] = useState<string | null>(null);

  const [word3, setWord3] = useState("");
  const [word7, setWord7] = useState("");
  const [word11, setWord11] = useState("");

  const [confirmationError, setConfirmationError] = useState<string | null>(
    null,
  );

  useEffect(() => {
    let mounted = true;

    void (async () => {
      try {
        const wallet = await walletApi.load();

        if (!mounted) {
          return;
        }

        if (wallet) {
          router.replace("/");
          return;
        }

        setWalletState({
          status: "empty",
        });
      } catch (error) {
        console.error("Onboarding bootstrap failed:", error);

        if (mounted) {
          setWalletState({
            status: "empty",
          });
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  async function finishWalletSetup(address: Address) {
    const pinConfigured = await securityApi.hasPin();

    if (!pinConfigured) {
      setWalletState({
        status: "securitySetup",
        address,
      });

      return;
    }

    router.replace("/");
  }

  async function handleImportWallet() {
    try {
      setImportError(null);

      const wallet = walletApi.import(importMnemonic);

      await walletApi.persist(wallet.mnemonic);

      await finishWalletSetup(wallet.address);

      setImportMnemonic("");
    } catch (error) {
      console.error("Wallet import failed:", error);

      setImportError("Invalid recovery phrase");
    }
  }

  async function handleGenerateWallet() {
    try {
      const wallet = await walletApi.generate();

      setWalletState({
        status: "generated",
        address: wallet.address,
        mnemonic: wallet.mnemonic,
      });
    } catch (error) {
      console.error("Wallet generation failed:", error);
    }
  }

  function startConfirming() {
    if (walletState.status !== "generated") {
      return;
    }

    setWord3("");
    setWord7("");
    setWord11("");
    setConfirmationError(null);

    setWalletState({
      status: "confirming",
      address: walletState.address,
      mnemonic: walletState.mnemonic,
    });
  }

  async function handleConfirmMnemonic() {
    if (walletState.status !== "confirming") {
      return;
    }

    const valid = walletApi.confirmMnemonic(walletState.mnemonic, [
      {
        index: 2,
        word: word3,
      },
      {
        index: 6,
        word: word7,
      },
      {
        index: 10,
        word: word11,
      },
    ]);

    if (!valid) {
      setConfirmationError("Words do not match. Check your notes.");
      return;
    }

    await walletApi.persist(walletState.mnemonic);

    await finishWalletSetup(walletState.address);
  }

  if (walletState.status === "loading") {
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

  if (walletState.status === "empty") {
    return (
      <OnboardingView
        onCreate={handleGenerateWallet}
        onRestore={() => {
          setImportError(null);

          setWalletState({
            status: "importing",
          });
        }}
      />
    );
  }

  if (walletState.status === "importing") {
    return (
      <RestoreView
        mnemonic={importMnemonic}
        error={importError}
        onChangeMnemonic={(value) => {
          setImportMnemonic(value);
          setImportError(null);
        }}
        onSubmit={handleImportWallet}
        onBack={() => {
          setImportMnemonic("");
          setImportError(null);

          setWalletState({
            status: "empty",
          });
        }}
      />
    );
  }

  if (walletState.status === "generated") {
    return (
      <PhraseView
        words={walletState.mnemonic.split(" ")}
        onDone={startConfirming}
        onCancel={() => {
          setWalletState({
            status: "empty",
          });
        }}
      />
    );
  }

  if (walletState.status === "confirming") {
    return (
      <VerifyView
        word3={word3}
        word7={word7}
        word11={word11}
        error={confirmationError}
        onChangeWord3={setWord3}
        onChangeWord7={setWord7}
        onChangeWord11={setWord11}
        onConfirm={handleConfirmMnemonic}
        onShowPhrase={() => {
          setWalletState({
            status: "generated",
            address: walletState.address,
            mnemonic: walletState.mnemonic,
          });
        }}
      />
    );
  }

  return (
    <PinView
      mode="setup"
      onSubmit={async (pin) => {
        try {
          await securityApi.setupPin(pin);

          router.replace("/");

          return null;
        } catch (error) {
          console.error("PIN setup failed:", error);

          return "Failed to create PIN";
        }
      }}
    />
  );
}
