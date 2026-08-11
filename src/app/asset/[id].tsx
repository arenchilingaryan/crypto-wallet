import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator } from "react-native";
import { getAddress, isAddress } from "viem";

import { AssetView } from "@/components/screens/asset-view";
import { Screen } from "@/components/ui/screen";
import { AppText } from "@/components/ui/text";
import { ACTIVE_NETWORK } from "@/constants/networks";
import { Colors } from "@/constants/theme";
import {
    getPortfolio,
    type PortfolioAsset,
} from "@/core/blockchain/getPortfolio";
import { getTokenMetadata } from "@/core/blockchain/getTokenMetadata";
import { findKnownTokenByAddress } from "@/core/blockchain/knownTokens";
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

      let foundAsset = portfolio.assets.find((item) => {
        if (assetId === "native") {
          return item.type === "native";
        }

        if (!item.contractAddress) {
          return false;
        }

        return item.contractAddress.toLowerCase() === assetId.toLowerCase();
      });

      // Токен из поиска, которого ещё нет в портфеле: показываем
      // карточку с нулевым балансом по реестру/метаданным.
      if (
        !foundAsset &&
        assetId !== "native" &&
        isAddress(assetId, {
          strict: false,
        })
      ) {
        const tokenAddress = getAddress(assetId);

        const known = findKnownTokenByAddress(ACTIVE_NETWORK.id, tokenAddress);

        const metadata = known ?? (await getTokenMetadata(tokenAddress));

        if (metadata) {
          foundAsset = {
            type: "erc20",

            symbol: metadata.symbol,

            name: metadata.name,

            balance: "0",

            priceUsd: null,

            valueUsd: null,

            logo: metadata.logo,

            contractAddress: tokenAddress,
          };
        }
      }

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

  if (!asset || error) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Asset",
          }}
        />

        <Screen
          onBack={() => {
            router.back();
          }}
        >
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
        onBack={() => {
          router.back();
        }}
      />
    </>
  );
}
