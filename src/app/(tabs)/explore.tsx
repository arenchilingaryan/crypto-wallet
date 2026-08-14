import { useEffect, useRef, useState } from "react";

import { useRouter } from "expo-router";

import { ExploreView } from "@/components/screens/explore-view";

import {
  getMarkets,
  type MarketList,
  type MarketToken,
} from "@/core/blockchain/getMarkets";

export default function ExploreScreen() {
  const router = useRouter();

  const [list, setList] = useState<MarketList>("trending");

  const [markets, setMarkets] = useState<MarketToken[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const cache = useRef<Partial<Record<MarketList, MarketToken[]>>>({});

  useEffect(() => {
    const cached = cache.current[list];

    if (cached) {
      setMarkets(cached);
      setError(null);
      setLoading(false);

      return;
    }

    let mounted = true;

    setLoading(true);
    setError(null);
    setMarkets([]);

    void getMarkets(list)
      .then((result) => {
        if (!mounted) {
          return;
        }

        cache.current[list] = result;

        setMarkets(result);
      })
      .catch((marketError) => {
        console.error("Market list failed:", marketError);

        if (mounted) {
          setError("Failed to load markets");
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [list]);

  return (
    <ExploreView
      list={list}
      markets={markets}
      loading={loading}
      error={error}
      onChangeList={setList}
      onSearch={() => {
        router.push("/search");
      }}
      onSelect={(market) => {
        router.push({
          pathname: "/asset/[id]",

          params: {
            id: market.address,
          },
        });
      }}
    />
  );
}
