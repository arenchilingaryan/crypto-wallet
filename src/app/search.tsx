import { useEffect, useRef, useState } from "react";

import { useRouter } from "expo-router";

import { AssetPickerView } from "@/components/screens/asset-picker-view";

import type { AssetSearchResult } from "@/core/blockchain/assetSearch";

import { getPortfolio, type Portfolio } from "@/core/blockchain/getPortfolio";

import { searchAssets } from "@/core/blockchain/searchAssets";

import { walletApi } from "@/platform/react-native/walletApi";

export default function SearchScreen() {
  const router = useRouter();

  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);

  const [query, setQuery] = useState("");

  const [results, setResults] = useState<AssetSearchResult[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  /*
   * Номер актуального search request.
   *
   * Нужен, чтобы старый async response
   * не затёр более новый.
   */
  const requestId = useRef(0);

  /*
   * STEP 1:
   *
   * Загружаем portfolio
   * активного wallet.
   *
   * Здесь searchAssets НЕ вызываем.
   * Иначе первоначальный search
   * запускался бы дважды.
   */
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

  /*
   * STEP 2:
   *
   * Один input:
   *
   * ETH
   * Ethereum
   * USDC
   * USD Coin
   * contract address
   *
   * Что именно ввёл пользователь,
   * определяет searchAssets().
   */
  useEffect(() => {
    if (!portfolio) {
      return;
    }

    setError(null);

    const currentRequest = ++requestId.current;

    /*
     * Пустой query:
     *
     * просто показываем assets wallet
     * без искусственной задержки.
     *
     * Текстовый поиск:
     *
     * debounce 350 ms,
     * чтобы не долбить remote API
     * на каждый символ.
     */
    const delay = query.trim() ? 350 : 0;

    const timer = setTimeout(() => {
      setLoading(true);

      void searchAssets(portfolio, query)
        .then((nextResults) => {
          /*
           * Пока запрос выполнялся,
           * пользователь уже мог
           * изменить query.
           */
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

      /*
       * Все старые async ответы
       * после изменения query
       * считаются неактуальными.
       */
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
      onChangeQuery={setQuery}
      onBack={() => {
        router.back();
      }}
      onSelect={(asset) => {
        /*
         * Используем ТОТ ЖЕ route,
         * что и Home.
         *
         * Native:
         * /asset/[id]
         * id = "native"
         *
         * ERC20:
         * /asset/[id]
         * id = contract address
         */
        const assetId =
          asset.type === "native" ? "native" : asset.contractAddress;

        if (!assetId) {
          return;
        }

        router.push({
          pathname: "/asset/[id]",

          params: {
            id: assetId,
          },
        });
      }}
    />
  );
}
