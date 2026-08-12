import { isTestnetNetwork } from "@/constants/networks";
import type { Address } from "viem";

export type AssetMarketPoint = {
  timestamp: number;
  priceUsd: number;
};

export type AssetMarketData = {
  priceUsd: number;
  /** Percent change over the requested range, first point → last point. */
  changePercent: number | null;
  points: AssetMarketPoint[];
};

type GetAssetMarketDataInput = {
  network: string;
  type: "native" | "erc20";
  symbol: string;
  contractAddress?: Address;
  range: MarketRange;
};

type AlchemyHistoricalPriceResponse = {
  symbol?: string;
  network?: string;
  address?: string;
  currency: string;
  data: {
    value: string;
    timestamp: string;
  }[];
};

// Alchemy historical prices supports exactly three intervals:
// '5m', '1h', '1d'. Anything else is a 400.
function getRangeConfig(range: MarketRange) {
  switch (range) {
    case "1H":
      return { hours: 1, interval: "5m" };
    case "1D":
      return { hours: 24, interval: "1h" };
    case "1W":
      return { hours: 24 * 7, interval: "1h" };
    case "1M":
      return { hours: 24 * 30, interval: "1d" };
    case "1Y":
      return { hours: 24 * 365, interval: "1d" };
  }
}

export type MarketRange = "1H" | "1D" | "1W" | "1M" | "1Y";

const API_KEY = process.env.EXPO_PUBLIC_ALCHEMY_API_KEY;

export async function getAssetMarketData({
  network,
  type,
  symbol,
  contractAddress,
  range,
}: GetAssetMarketDataInput): Promise<AssetMarketData | null> {
  if (!API_KEY) {
    throw new Error("Alchemy API key is missing");
  }

  // Testnet token ≠ asset with a real USD market value.
  if (isTestnetNetwork(network)) {
    return null;
  }

  if (type === "erc20" && !contractAddress) {
    throw new Error("Contract address is required for ERC20 market data");
  }

  const { hours, interval } = getRangeConfig(range);

  const endTime = new Date();

  const startTime = new Date(endTime.getTime() - hours * 60 * 60 * 1000);

  const tokenIdentity =
    type === "native"
      ? {
          symbol,
        }
      : {
          network,
          address: contractAddress,
        };

  const response = await fetch(
    `https://api.g.alchemy.com/prices/v1/${API_KEY}/tokens/historical`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...tokenIdentity,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        interval,
      }),
    },
  );

  if (!response.ok) {
    const responseText = await response.text();

    throw new Error(
      `Alchemy historical prices failed: ${response.status} ${responseText}`,
    );
  }

  const result = (await response.json()) as AlchemyHistoricalPriceResponse;

  const points = result.data
    .map((item): AssetMarketPoint => {
      return {
        timestamp: new Date(item.timestamp).getTime(),

        priceUsd: Number(item.value),
      };
    })
    .filter((point) => {
      return (
        Number.isFinite(point.timestamp) && Number.isFinite(point.priceUsd)
      );
    })
    .sort((a, b) => {
      return a.timestamp - b.timestamp;
    });

  if (points.length === 0) {
    return null;
  }

  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];

  const changePercent =
    firstPoint.priceUsd > 0
      ? ((lastPoint.priceUsd - firstPoint.priceUsd) / firstPoint.priceUsd) * 100
      : null;

  return {
    priceUsd: lastPoint.priceUsd,
    changePercent,
    points,
  };
}
