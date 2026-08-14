import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
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
import type { TokenIntelligence } from "@/core/token-intelligence/types";
import {
  createUnavailableTokenIntelligence,
  loadTokenIntelligence,
} from "@/platform/react-native/token-intelligence";
import { walletApi } from "@/platform/react-native/walletApi";

import {
    getAssetMarketData,
    type AssetMarketData,
    type MarketRange,
} from "@/core/blockchain/getAssetMarketData";

export default function AssetScreen() {
  const { id, origin } = useLocalSearchParams<{
    id?: string;
    origin?: string;
  }>();

  const [asset, setAsset] = useState<PortfolioAsset | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [marketData, setMarketData] = useState<AssetMarketData | null>(null);
  const [range, setRange] = useState<MarketRange>("1D");
  const [marketPending, setMarketPending] = useState(false);
  const [networkId, setNetworkId] = useState<string | null>(null);
  const [intelligence, setIntelligence] =
    useState<TokenIntelligence | null>(null);
  const [intelligenceRequestNonce, setIntelligenceRequestNonce] = useState(0);

  const marketRequestId = useRef(0);
  const forceIntelligenceRefresh = useRef(false);

  const loadedRange = useRef<MarketRange | null>(null);

  const loadAssetRef = useRef(loadAsset);

  loadAssetRef.current = loadAsset;

  const router = useRouter();

  useEffect(() => {
    if (!id) {
      setError("Asset id is missing");
      setLoading(false);
      return;
    }

    void loadAssetRef.current(id);
  }, [id]);

  const intelligenceAddress =
    asset?.type === "erc20" ? asset.contractAddress : null;
  const intelligenceSymbol = asset?.symbol;
  const intelligenceName = asset?.name;

  useEffect(() => {
    if (!intelligenceAddress) {
      setIntelligence(null);
      return;
    }

    let active = true;
    const forceRefresh = forceIntelligenceRefresh.current;
    const token = {
      chainId: ACTIVE_NETWORK.chain.id,
      address: intelligenceAddress,
      symbol: intelligenceSymbol ?? "unknown",
      name: intelligenceName ?? "unknown",
    } as const;

    forceIntelligenceRefresh.current = false;

    void loadTokenIntelligence({
      token,
      forceRefresh,
      onUpdate: ({ intelligence: nextIntelligence }) => {
        if (active) {
          setIntelligence(nextIntelligence);
        }
      },
    })
      .then(({ intelligence: nextIntelligence }) => {
        if (active) {
          setIntelligence(nextIntelligence);
        }
      })
      .catch((intelligenceError) => {
        if (active) {
          console.error("Token intelligence loading failed:", intelligenceError);
          setIntelligence(
            createUnavailableTokenIntelligence(
              token,
              "Token intelligence could not be loaded",
            ),
          );
        }
      });

    return () => {
      active = false;
    };
  }, [
    intelligenceAddress,
    intelligenceName,
    intelligenceRequestNonce,
    intelligenceSymbol,
  ]);

  async function loadAsset(assetId: string) {
    try {
      setLoading(true);
      setError(null);
      setAsset(null);
      setMarketData(null);

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

            decimals: metadata.decimals,

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
      setNetworkId(portfolio.networkId);
      setLoading(false);

      try {
        const requestId = ++marketRequestId.current;

        const data = await fetchMarketData(
          portfolio.networkId,
          foundAsset,
          range,
        );

        if (marketRequestId.current === requestId) {
          setMarketData(data);

          if (data) {
            loadedRange.current = range;
          }
        }
      } catch (marketError) {
        console.error("Market data loading failed:", marketError);
      }
    } catch (error) {
      console.error("Asset loading failed:", error);

      setError("Failed to load asset");
    } finally {
      setLoading(false);
    }
  }

  function fetchMarketData(
    network: string,
    target: PortfolioAsset,
    nextRange: MarketRange,
  ) {
    return getAssetMarketData({
      network,
      symbol: target.symbol,
      type: target.type,
      contractAddress: target.contractAddress,
      range: nextRange,
    });
  }

  async function handleChangeRange(nextRange: MarketRange) {
    if (nextRange === range) {
      return;
    }

    if (!asset || !networkId) {
      return;
    }

    setRange(nextRange);
    setMarketPending(true);

    const requestId = ++marketRequestId.current;

    try {
      const data = await fetchMarketData(networkId, asset, nextRange);

      if (marketRequestId.current !== requestId) {
        return;
      }

      if (data) {
        setMarketData(data);
        loadedRange.current = nextRange;
      } else if (loadedRange.current) {
        setRange(loadedRange.current);
      }
    } catch (error) {
      console.error("Market data loading failed:", error);

      if (marketRequestId.current === requestId && loadedRange.current) {
        setRange(loadedRange.current);
      }
    } finally {
      if (marketRequestId.current === requestId) {
        setMarketPending(false);
      }
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
        range={range}
        marketPending={marketPending}
        intelligence={intelligence}
        onChangeRange={handleChangeRange}
        onRetryIntelligence={() => {
          forceIntelligenceRefresh.current = true;
          setIntelligenceRequestNonce((nonce) => nonce + 1);
        }}
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
        onSwap={() => {
          const assetId =
            asset.type === "native" ? "native" : asset.contractAddress;

          if (!assetId) {
            return;
          }

          router.push({
            pathname: "/swap",
            params:
              origin === "explore" && asset.type === "erc20"
                ? { to: assetId }
                : { from: assetId },
          });
        }}
        onBack={() => {
          router.back();
        }}
      />
    </>
  );
}
