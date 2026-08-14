import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert } from "react-native";

import { PhraseView } from "@/components/screens/phrase-view";
import { RestoreView } from "@/components/screens/restore-view";
import { VerifyView } from "@/components/screens/verify-view";
import { WalletsView } from "@/components/screens/wallets-view";
import { Screen } from "@/components/ui/screen";
import { Colors } from "@/constants/theme";
import {
  WalletStorageUnavailableError,
  type WalletAccount,
} from "@/core/wallet/walletEngine";
import { walletApi } from "@/platform/react-native/walletApi";

import type { Address } from "viem";

type Mode = "list" | "importing" | "generated" | "confirming";

type PendingWallet = {
  address: Address;
  mnemonic: string;
};

function describeWalletError(error: unknown, fallback: string) {
  return error instanceof WalletStorageUnavailableError
    ? error.message
    : fallback;
}

export default function WalletsScreen() {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("list");

  const [wallets, setWallets] = useState<WalletAccount[]>([]);

  const [activeWalletId, setActiveWalletId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const [pendingWallet, setPendingWallet] = useState<PendingWallet | null>(
    null,
  );

  const [importMnemonic, setImportMnemonic] = useState("");

  const [importError, setImportError] = useState<string | null>(null);

  const [word3, setWord3] = useState("");
  const [word7, setWord7] = useState("");
  const [word11, setWord11] = useState("");

  const [confirmationError, setConfirmationError] = useState<string | null>(
    null,
  );

  useEffect(() => {
    void loadWallets();
  }, []);

  async function loadWallets() {
    try {
      setLoading(true);
      setError(null);

      const [walletList, activeWallet, health] = await Promise.all([
        walletApi.list(),
        walletApi.load(),
        walletApi.health(),
      ]);

      setWallets(walletList);

      setActiveWalletId(activeWallet?.id ?? null);

      if (health.status === "degraded") {
        setError(
          "Wallet storage could not be read. Wallets shown here may be out of date, and changes are blocked until it works again.",
        );
      } else if (health.walletsWithoutSecret.length > 0) {
        setError(
          `No recovery phrase is stored for ${health.walletsWithoutSecret.length} of these wallets. They cannot sign anything — restore them from their recovery phrase.`,
        );
      }
    } catch (error) {
      console.error("Wallet list loading failed:", error);

      setError(describeWalletError(error, "Failed to load wallets"));
    } finally {
      setLoading(false);
    }
  }

  async function handleSelect(walletId: string) {
    try {
      await walletApi.setActive(walletId);

      router.back();
    } catch (error) {
      console.error("Wallet switch failed:", error);

      setError(describeWalletError(error, "Failed to switch wallet"));
    }
  }

  async function handleGenerateWallet() {
    try {
      setError(null);

      const { address, recoveryPhrase } = await walletApi.prepare();

      setPendingWallet({
        address,
        mnemonic: recoveryPhrase,
      });

      setMode("generated");
    } catch (error) {
      console.error("Wallet generation failed:", error);

      setError(describeWalletError(error, "Failed to create wallet"));
    }
  }

  async function handleImportWallet() {
    try {
      setImportError(null);

      await walletApi.importFromMnemonic(importMnemonic);

      setImportMnemonic("");

      router.back();
    } catch (error) {
      console.error("Wallet import failed:", error);

      setImportError(describeWalletError(error, "Invalid recovery phrase"));
    }
  }

  function startConfirming() {
    if (!pendingWallet) {
      return;
    }

    setWord3("");
    setWord7("");
    setWord11("");
    setConfirmationError(null);

    setMode("confirming");
  }

  async function handleConfirmMnemonic() {
    if (!pendingWallet) {
      return;
    }

    const valid = walletApi.confirmMnemonic(pendingWallet.mnemonic, [
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
      await walletApi.create(pendingWallet.mnemonic);
    } catch (error) {
      console.error("Wallet creation failed:", error);

      setConfirmationError(
        describeWalletError(error, "Could not save the wallet. Try again."),
      );

      return;
    }

    setPendingWallet(null);

    router.back();
  }

  function handleRemove(wallet: WalletAccount) {
    Alert.alert(
      "Remove wallet",
      `Remove ${wallet.name} from this device? Make sure you have saved its recovery phrase.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            void removeWallet(wallet.id);
          },
        },
      ],
    );
  }

  async function removeWallet(walletId: string) {
    try {
      setError(null);

      const nextActiveWallet = await walletApi.remove(walletId);

      const walletList = await walletApi.list();

      setWallets(walletList);

      setActiveWalletId(nextActiveWallet?.id ?? null);

      if (walletList.length === 0) {
        router.replace("/");
      }
    } catch (error) {
      console.error("Wallet removal failed:", error);

      setError(describeWalletError(error, "Failed to remove wallet"));
    }
  }

  if (mode === "importing") {
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
          setMode("list");
        }}
      />
    );
  }

  if (mode === "generated" && pendingWallet) {
    return (
      <PhraseView
        words={pendingWallet.mnemonic.split(" ")}
        onDone={startConfirming}
        onCancel={() => {
          setPendingWallet(null);
          setMode("list");
        }}
      />
    );
  }

  if (mode === "confirming" && pendingWallet) {
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
          setMode("generated");
        }}
      />
    );
  }

  if (loading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Wallets",
          }}
        />

        <Screen
          onBack={() => {
            router.back();
          }}
          style={{
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ActivityIndicator color={Colors.textSecondary} />
        </Screen>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: "Wallets",
        }}
      />

      <WalletsView
        wallets={wallets}
        activeWalletId={activeWalletId}
        error={error}
        onSelect={handleSelect}
        onCreate={handleGenerateWallet}
        onImport={() => {
          setImportError(null);
          setMode("importing");
        }}
        onRemove={handleRemove}
        onBack={() => {
          router.back();
        }}
      />
    </>
  );
}
