import { useCallback, useEffect, useRef, useState } from "react";

import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";

import { AssetPickerView } from "@/components/screens/asset-picker-view";

import type { AssetSearchResult } from "@/core/blockchain/assetSearch";

import { getPortfolio, type Portfolio } from "@/core/blockchain/getPortfolio";

import { searchAssets } from "@/core/blockchain/searchAssets";

import { ACTIVE_NETWORK } from "@/constants/networks";

import { assetRouteParams } from "@/core/navigation/assetRoute";
import { watchKey } from "@/core/watchlist/watchlist";

import { walletApi } from "@/platform/react-native/walletApi";
import { watchlistApi } from "@/platform/react-native/watchlistApi";

export default function SearchScreen() {
  const router = useRouter();

  const { origin } = useLocalSearchParams<{ origin?: string }>();

  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);

  const [query, setQuery] = useState("");

  const [results, setResults] = useState<AssetSearchResult[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  // Watch membership is a local fact and is loaded on its own: Explore must
  // still show the star even if search or the risk providers are struggling.
  const [watchedKeys, setWatchedKeys] = useState<Set<string>>(new Set());

  const [watchUnavailable, setWatchUnavailable] = useState(false);

  const requestId = useRef(0);

  // Re-read on focus, not just on mount: this screen stays mounted while the
  // user opens a token and watches it, so a mount-only read would keep showing
  // the pre-tap state — including a star on something just unwatched.
  useFocusEffect(
    useCallback(() => {
      let active = true;

      void watchlistApi
        .load()
        .then((snapshot) => {
          if (!active) {
            return;
          }

          if (snapshot.status !== "ready") {
            // Not knowing is not "not watching". Say so once, rather than
            // silently drawing every row without a star.
            setWatchUnavailable(true);

            return;
          }

          setWatchUnavailable(false);

          setWatchedKeys(new Set(snapshot.items.map((item) => watchKey(item))));
        })
        .catch((watchError) => {
          console.error("Watchlist membership lookup failed:", watchError);

          if (active) {
            setWatchUnavailable(true);
          }
        });

      return () => {
        active = false;
      };
    }, []),
  );

  useEffect(() => {
    let mounted = true;

    void (async () => {
      try {
        setLoading(true);
        setError(null);

        const wallet = await walletApi.load();

        if (!wallet) {
          throw new Error("Active wallet not found");
        }

        const nextPortfolio = await getPortfolio(wallet.address);

        if (!mounted) {
          return;
        }

        setPortfolio(nextPortfolio);
      } catch (bootstrapError) {
        console.error("Search bootstrap failed:", bootstrapError);

        if (!mounted) {
          return;
        }

        setError(
          bootstrapError instanceof Error
            ? bootstrapError.message
            : "Failed to load assets",
        );

        setResults([]);

        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!portfolio) {
      return;
    }

    setError(null);

    const currentRequest = ++requestId.current;

    const delay = query.trim() ? 350 : 0;

    const timer = setTimeout(() => {
      setLoading(true);

      void searchAssets(portfolio, query)
        .then((nextResults) => {
          if (currentRequest !== requestId.current) {
            return;
          }

          setResults(nextResults);
        })
        .catch((searchError) => {
          if (currentRequest !== requestId.current) {
            return;
          }

          console.error("Asset search failed:", searchError);

          setResults([]);

          setError(
            searchError instanceof Error
              ? searchError.message
              : "Search failed",
          );
        })
        .finally(() => {
          if (currentRequest === requestId.current) {
            setLoading(false);
          }
        });
    }, delay);

    return () => {
      clearTimeout(timer);

      requestId.current++;
    };
  }, [query, portfolio]);

  return (
    <AssetPickerView
      title="Search assets"
      query={query}
      results={results}
      loading={loading}
      error={error}
      watchUnavailable={watchUnavailable}
      isWatched={(asset) =>
        asset.contractAddress
          ? watchedKeys.has(
              watchKey({
                chainId: ACTIVE_NETWORK.chain.id,
                address: asset.contractAddress,
              }),
            )
          : false
      }
      onChangeQuery={setQuery}
      onBack={() => {
        router.back();
      }}
      onSelect={(asset) => {
        const assetId =
          asset.type === "native" ? "native" : asset.contractAddress;

        if (!assetId) {
          return;
        }

        router.push({
          pathname: "/asset/[id]",

          params: {
            ...assetRouteParams({
              chainId: ACTIVE_NETWORK.chain.id,
              address: assetId,
            }),
            ...(origin === "explore" ? { origin: "explore" } : {}),
          },
        });
      }}
    />
  );
}
