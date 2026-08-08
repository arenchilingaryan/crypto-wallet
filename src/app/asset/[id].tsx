import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator } from "react-native";

import { AssetView } from "@/components/screens/asset-view";
import { Screen } from "@/components/ui/screen";
import { AppText } from "@/components/ui/text";
import { Colors } from "@/constants/theme";
import {
    getPortfolio,
    type PortfolioAsset,
} from "@/core/blockchain/getPortfolio";
import { walletApi } from "@/platform/react-native/walletApi";

import {
    getAssetMarketData,
    type AssetMarketData,
} from "@/core/blockchain/getAssetMarketData";

export default function AssetScreen() {
  const { id } = useLocalSearchParams<{
    id?: string;
  }>();

  const [asset, setAsset] = useState<PortfolioAsset | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [marketData, setMarketData] = useState<AssetMarketData | null>(null);

  const router = useRouter();

  useEffect(() => {
    if (!id) {
      setError("Asset id is missing");
      setLoading(false);
      return;
    }

    void loadAsset(id);
  }, [id]);

  async function loadAsset(assetId: string) {
    try {
      setLoading(true);
      setError(null);

      const wallet = await walletApi.load();

      if (!wallet) {
        throw new Error("Wallet not found");
      }

      const portfolio = await getPortfolio(wallet.address);

      const foundAsset = portfolio.assets.find((item) => {
        if (assetId === "native") {
          return item.type === "native";
        }

        if (!item.contractAddress) {
          return false;
        }

        return item.contractAddress.toLowerCase() === assetId.toLowerCase();
      });

      if (!foundAsset) {
        throw new Error("Asset not found");
      }

      setAsset(foundAsset);

      const marketData = await getAssetMarketData({
        network: portfolio.networkId,
        symbol: foundAsset.symbol,
        type: foundAsset.type,
        contractAddress: foundAsset.contractAddress,
      });

      setMarketData(marketData);

      setAsset(foundAsset);
    } catch (error) {
      console.error("Asset loading failed:", error);

      setError("Failed to load asset");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Asset",
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

  if (!asset || error) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Asset",
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
          title: asset.symbol,
        }}
      />

      <AssetView
        asset={asset}
        marketData={marketData}
        onReceive={() => {
          if (!id) {
            return;
          }

          router.push({
            pathname: "/receive/[id]",
            params: {
              id,
            },
          });
        }}
      />
    </>
  );
}
