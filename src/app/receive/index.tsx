import { useEffect, useRef, useState } from "react";

import { useRouter } from "expo-router";

import { AssetPickerView } from "@/components/screens/asset-picker-view";

import type { AssetSearchResult } from "@/core/blockchain/assetSearch";

import { getPortfolio, type Portfolio } from "@/core/blockchain/getPortfolio";

import { searchAssets } from "@/core/blockchain/searchAssets";

import { walletApi } from "@/platform/react-native/walletApi";

export default function ReceiveAssetPickerScreen() {
  const router = useRouter();

  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);

  const [query, setQuery] = useState("");

  const [results, setResults] = useState<AssetSearchResult[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const requestId = useRef(0);

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
        console.error("Receive picker bootstrap failed:", bootstrapError);

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

          console.error("Receive asset search failed:", searchError);

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
      title="Receive"
      query={query}
      results={results}
      loading={loading}
      error={error}
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
          pathname: "/receive/[id]",

          params: {
            id: assetId,
          },
        });
      }}
    />
  );
}
