import { useEffect, useState } from "react";

import { useRouter } from "expo-router";

import { OnboardingView } from "@/components/screens/onboarding-view";
import { PhraseView } from "@/components/screens/phrase-view";
import { PinView } from "@/components/screens/pin-view";
import { RestoreView } from "@/components/screens/restore-view";
import { VerifyView } from "@/components/screens/verify-view";
import { Screen } from "@/components/ui/screen";

import { Colors } from "@/constants/theme";

import { describeImportFailure } from "@/core/wallet/describeImportFailure";
import { importWallet } from "@/core/wallet/importWallet";

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
      // The PIN is set before the wallet is committed, so the phrase is still
      // only in the user's hands and in this state. Nothing has been written
      // to the registry yet: abandoning here leaves no trace.
      status: "securitySetup";
      address: Address;
      mnemonic: string;
      mode: "create" | "import";
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

  // A wallet is only committed once there is a vault to seal its phrase into.
  // Until the PIN exists the phrase would be staged in process memory alone,
  // and a crash in that window used to leave a wallet in the registry whose
  // secret had evaporated.
  async function commitWallet(mnemonic: string, mode: "create" | "import") {
    if (mode === "create") {
      await walletApi.create(mnemonic);
    } else {
      await walletApi.importFromMnemonic(mnemonic);
    }
  }

  async function continueWith(mnemonic: string, mode: "create" | "import") {
    const { address } = importWallet(mnemonic);

    const pinConfigured = await securityApi.hasPin();

    if (!pinConfigured) {
      setWalletState({
        status: "securitySetup",
        address,
        mnemonic,
        mode,
      });

      return;
    }

    await commitWallet(mnemonic, mode);

    router.replace("/");
  }

  async function handleImportWallet() {
    try {
      setImportError(null);

      await continueWith(importMnemonic, "import");

      setImportMnemonic("");
    } catch (error) {
      console.error("Wallet import failed:", error);

      setImportError(describeImportFailure(error));
    }
  }

  async function handleGenerateWallet() {
    try {
      const { address, recoveryPhrase } = await walletApi.prepare();

      setWalletState({
        status: "generated",
        address,
        mnemonic: recoveryPhrase,
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

    try {
      await continueWith(walletState.mnemonic, "create");
    } catch (error) {
      console.error("Wallet creation failed:", error);

      setConfirmationError("Could not save the wallet. Try again.");
    }
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

  const pending = walletState;

  return (
    <PinView
      mode="setup"
      onSubmit={async (pin) => {
        try {
          // Vault first, wallet second: after this the secret store has
          // somewhere durable to write, so the commit either completes or
          // leaves nothing at all.
          await securityApi.setupPin(pin);

          await commitWallet(pending.mnemonic, pending.mode);

          setImportMnemonic("");

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
