import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator } from "react-native";

import { ReceiveView } from "@/components/screens/receive-view";
import { Screen } from "@/components/ui/screen";
import { AppText } from "@/components/ui/text";
import { Colors } from "@/constants/theme";
import {
    getPortfolio,
    type PortfolioAsset,
} from "@/core/blockchain/getPortfolio";
import { walletApi } from "@/platform/react-native/walletApi";

import type { Address } from "viem";

type ReceiveState = {
  address: Address;
  asset: PortfolioAsset;
  network: string;
};

export default function ReceiveScreen() {
  const { id } = useLocalSearchParams<{
    id?: string;
  }>();

  const [data, setData] = useState<ReceiveState | null>(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError("Asset id is missing");
      setLoading(false);
      return;
    }

    void loadReceiveData(id);
  }, [id]);

  async function loadReceiveData(assetId: string) {
    try {
      setLoading(true);
      setError(null);

      const wallet = await walletApi.load();

      if (!wallet) {
        throw new Error("Wallet not found");
      }

      const portfolio = await getPortfolio(wallet.address);

      const asset = portfolio.assets.find((item) => {
        if (assetId === "native") {
          return item.type === "native";
        }

        return item.contractAddress?.toLowerCase() === assetId.toLowerCase();
      });

      if (!asset) {
        throw new Error("Asset not found");
      }

      setData({
        address: wallet.address,
        asset,
        network: portfolio.network,
      });
    } catch (error) {
      console.error("Receive data loading failed:", error);

      setError("Failed to load receive information");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Receive",
          }}
        />

        <Screen
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

  if (!data || error) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Receive",
          }}
        />

        <Screen>
          <AppText variant="bodyStrong" tone="danger">
            {error ?? "Asset not found"}
          </AppText>
        </Screen>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: `Receive ${data.asset.symbol}`,
        }}
      />

      <Screen>
        <ReceiveView
          address={data.address}
          symbol={data.asset.symbol}
          network={data.network}
        />
      </Screen>
    </>
  );
}
