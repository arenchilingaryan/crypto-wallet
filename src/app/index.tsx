import { useEffect, useState } from "react";
import { ActivityIndicator } from "react-native";

import { HomeView } from "@/components/screens/home-view";
import { OnboardingView } from "@/components/screens/onboarding-view";
import { PhraseView } from "@/components/screens/phrase-view";
import { RestoreView } from "@/components/screens/restore-view";
import { VerifyView } from "@/components/screens/verify-view";
import { Screen } from "@/components/ui/screen";
import { Colors } from "@/constants/theme";
import { getPortfolio, type Portfolio } from "@/core/blockchain/getPortfolio";
import { walletApi } from "@/platform/react-native/walletApi";

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
      status: "ready";
      address: Address;
    };

export default function Index() {
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
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [portfolioError, setPortfolioError] = useState<string | null>(null);

  useEffect(() => {
    bootstrap();
  }, []);

  useEffect(() => {
    if (walletState.status !== "ready") {
      return;
    }

    setPortfolio(null);
    setPortfolioError(null);

    getPortfolio(walletState.address)
      .then((result) => {
        setPortfolio(result);
      })
      .catch((error) => {
        console.error("Portfolio load failed:", error);
        setPortfolioError("Failed to load portfolio");
      });
  }, [walletState]);

  async function bootstrap() {
    try {
      const wallet = await walletApi.load();

      if (!wallet) {
        setWalletState({
          status: "empty",
        });

        return;
      }

      setWalletState({
        status: "ready",
        address: wallet.address,
      });
    } catch (error) {
      console.error("Wallet bootstrap failed:", error);
    }
  }

  async function handleImportWallet() {
    try {
      setImportError(null);

      const wallet = walletApi.import(importMnemonic);

      await walletApi.persist(wallet.mnemonic);

      setWalletState({
        status: "ready",
        address: wallet.address,
      });

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

    setWalletState({
      status: "ready",
      address: walletState.address,
    });
  }

  if (walletState.status === "loading") {
    return (
      <Screen style={{ alignItems: "center", justifyContent: "center" }}>
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
          setWalletState({ status: "importing" });
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
          setWalletState({ status: "empty" });
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
          setWalletState({ status: "empty" });
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
    <HomeView
      address={walletState.address}
      portfolio={portfolio}
      error={portfolioError}
    />
  );
}
