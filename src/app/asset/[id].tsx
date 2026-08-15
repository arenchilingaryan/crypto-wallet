import { Stack, useLocalSearchParams, useRouter } from "expo-router";

import { goBack } from "@/utils/navigation";
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
import { parseRouteChainId } from "@/core/navigation/assetRoute";
import { walletApi } from "@/platform/react-native/walletApi";
import type { WatchStatus } from "@/core/watchlist/watchlistStore";
import { watchlistApi } from "@/platform/react-native/watchlistApi";

import {
    getAssetMarketData,
    type AssetMarketData,
    type MarketRange,
} from "@/core/blockchain/getAssetMarketData";

export default function AssetScreen() {
  const { id, origin, chainId: chainIdParam } = useLocalSearchParams<{
    id?: string;
    origin?: string;
    chainId?: string;
  }>();

  // Identity travels with the route. Falling back to the active network keeps
  // older entry points working, but the route is what decides when it says so.
  const routeChainId = parseRouteChainId(
    chainIdParam,
    ACTIVE_NETWORK.chain.id,
  );

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

  const [watchStatus, setWatchStatus] = useState<WatchStatus>("not-watching");

  const [watchPending, setWatchPending] = useState(false);

  const [watchError, setWatchError] = useState<string | null>(null);

  const marketRequestId = useRef(0);

  // Expo Router can keep this screen mounted while `id` changes. Without a
  // generation stamp, a slow load for the previous token finishes last and
  // paints itself over the token the user actually navigated to.
  const assetRequestId = useRef(0);

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

    // The route may name a network this build does not run on (a deep link, or
    // a watchlist entry made elsewhere). Everything below — balances, metadata,
    // provider support — comes from the active network, so honouring a foreign
    // chainId would render one network's risk verdict over another network's
    // balance and then save a watchlist entry under the wrong identity. Refuse
    // it instead of quietly substituting the active chain.
    if (routeChainId !== ACTIVE_NETWORK.chain.id) {
      setError(`This token is not on ${ACTIVE_NETWORK.name}`);
      setLoading(false);
      return;
    }

    void loadAssetRef.current(id);

    return () => {
      // Leaving this route (or changing its id) retires whatever is in flight.
      assetRequestId.current += 1;
    };
  }, [id, routeChainId]);

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
      chainId: routeChainId,
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
    routeChainId,
  ]);

  async function loadAsset(assetId: string) {
    const requestId = ++assetRequestId.current;

    const isCurrent = () => assetRequestId.current === requestId;

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

            // Read from the contract's own metadata, not a fallback.
            decimalsKnown: true,

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

      if (!isCurrent()) {
        return;
      }

      setAsset(foundAsset);
      setNetworkId(portfolio.networkId);
      setLoading(false);

      try {
        const marketRequest = ++marketRequestId.current;

        const data = await fetchMarketData(
          portfolio.networkId,
          foundAsset,
          range,
        );

        if (isCurrent() && marketRequestId.current === marketRequest) {
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

      if (isCurrent()) {
        setError("Failed to load asset");
      }
    } finally {
      if (isCurrent()) {
        setLoading(false);
      }
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

  // Only a contract-backed token has the (chain, address) identity a watchlist
  // entry is made of; the native coin has no address to key on.
  const watchableAddress =
    asset?.type === "erc20" && asset.contractAddress
      ? asset.contractAddress
      : null;

  useEffect(() => {
    if (!watchableAddress) {
      setWatchStatus("not-watching");

      return;
    }

    let active = true;

    void watchlistApi
      .isWatched({
        chainId: routeChainId,
        address: watchableAddress,
      })
      .then((result) => {
        if (active) {
          setWatchStatus(result);
        }
      })
      .catch((lookupError) => {
        console.error("Watchlist lookup failed:", lookupError);

        // Not knowing is its own state: an empty star here would assert the
        // token is not on a list we could not even open.
        if (active) {
          setWatchStatus("unreadable");
        }
      });

    return () => {
      active = false;
    };
  }, [watchableAddress, routeChainId]);

  async function handleToggleWatch() {
    if (!watchableAddress || watchPending || watchStatus === "unreadable") {
      return;
    }

    const id = {
      chainId: routeChainId,
      address: watchableAddress,
    };

    const previous = watchStatus;

    const next = watchStatus === "watching" ? "not-watching" : "watching";

    setWatchPending(true);

    setWatchError(null);

    // Optimistic, but only because the rollback below is real: if the write
    // fails the star must not keep claiming the token was saved.
    setWatchStatus(next);

    try {
      const result =
        next === "watching"
          ? await watchlistApi.add(id)
          : await watchlistApi.remove(id);

      if (!result.ok) {
        setWatchStatus(previous);

        setWatchError(result.message);
      }
    } catch (toggleError) {
      console.error("Watchlist update failed:", toggleError);

      setWatchStatus(previous);

      setWatchError("The watchlist could not be updated.");
    } finally {
      setWatchPending(false);
    }
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
            goBack("/");
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
            goBack("/");
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
        watch={
          watchableAddress
            ? {
                status: watchStatus,
                pending: watchPending,
                error: watchError,
                onToggle: () => {
                  void handleToggleWatch();
                },
              }
            : null
        }
        onChangeRange={handleChangeRange}
        onRetryIntelligence={() => {
          forceIntelligenceRefresh.current = true;
          setIntelligenceRequestNonce((nonce) => nonce + 1);
        }}
        onReceive={() => {
          // Derived from the asset actually on screen, not from the raw route
          // parameter, so Receive can never open a different token than the
          // one the user is looking at.
          const assetId =
            asset.type === "native" ? "native" : asset.contractAddress;

          if (!assetId) {
            return;
          }

          router.push({
            pathname: "/receive/[id]",
            params: {
              id: assetId,
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
              // Arriving from Explore or the watchlist means the user is
              // looking at something they are interested in acquiring, not
              // something they hold — prefilling it as the token being sold
              // would set up a swap of a zero balance.
              (origin === "explore" || origin === "watchlist") &&
              asset.type === "erc20"
                ? { to: assetId }
                : { from: assetId },
          });
        }}
        onBack={() => {
          goBack("/");
        }}
      />
    </>
  );
}
