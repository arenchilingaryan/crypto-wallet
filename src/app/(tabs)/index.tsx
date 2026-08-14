import { useCallback, useState } from "react";

import { Redirect, useFocusEffect } from "expo-router";

import { ActivityIndicator } from "react-native";

import type { Address } from "viem";

import { HomeView } from "@/components/screens/home-view";
import { Screen } from "@/components/ui/screen";

import { Colors } from "@/constants/theme";

import { getPortfolio, type Portfolio } from "@/core/blockchain/getPortfolio";
import {
  getPortfolioChange,
  type PortfolioChange,
} from "@/core/blockchain/getPortfolioChange";

import { walletApi } from "@/platform/react-native/walletApi";

type HomeState =
  | {
      status: "loading";
    }
  | {
      status: "missing";
    }
  | {
      status: "ready";
      address: Address;
      name: string;
    };

export default function WalletScreen() {
  const [walletState, setWalletState] = useState<HomeState>({
    status: "loading",
  });

  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);

  const [portfolioError, setPortfolioError] = useState<string | null>(null);

  const [change, setChange] = useState<PortfolioChange | null>(null);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      setPortfolio(null);
      setPortfolioError(null);
      setChange(null);

      void (async () => {
        try {
          const wallet = await walletApi.load();

          if (!mounted) {
            return;
          }

          if (!wallet) {
            setWalletState({
              status: "missing",
            });

            return;
          }

          setWalletState({
            status: "ready",
            address: wallet.address,
            name: wallet.name,
          });

          try {
            const nextPortfolio = await getPortfolio(wallet.address);

            if (!mounted) {
              return;
            }

            setPortfolio(nextPortfolio);

            const nextChange = await getPortfolioChange(nextPortfolio);

            if (mounted) {
              setChange(nextChange);
            }
          } catch (error) {
            console.error("Portfolio load failed:", error);

            if (mounted) {
              setPortfolioError("Failed to load portfolio");
            }
          }
        } catch (error) {
          console.error("Wallet bootstrap failed:", error);

          if (mounted) {
            setWalletState({
              status: "missing",
            });
          }
        }
      })();

      return () => {
        mounted = false;
      };
    }, []),
  );

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

  if (walletState.status === "missing") {
    return <Redirect href="/onboarding" />;
  }

  return (
    <HomeView
      address={walletState.address}
      walletName={walletState.name}
      portfolio={portfolio}
      change={change}
      error={portfolioError}
    />
  );
}
