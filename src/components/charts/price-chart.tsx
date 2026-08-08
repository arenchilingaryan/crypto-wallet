import { useMemo, useState } from "react";
import { View } from "react-native";

import { AppText } from "@/components/ui/text";
import type { AssetMarketPoint } from "@/core/blockchain/getAssetMarketData";

import { styles } from "./price-chart.styles";

type PriceChartProps = {
  points: AssetMarketPoint[];
};

type ChartPoint = {
  x: number;
  y: number;
};

const CHART_HEIGHT = 180;
const CHART_PADDING = 12;

export function PriceChart({ points }: PriceChartProps) {
  const [width, setWidth] = useState(0);

  const validPoints = useMemo(
    () =>
      points.filter(
        (point) =>
          Number.isFinite(point.timestamp) && Number.isFinite(point.priceUsd),
      ),
    [points],
  );

  const chartPoints = useMemo(() => {
    if (width <= 0 || validPoints.length < 2) {
      return [];
    }

    const prices = validPoints.map((point) => point.priceUsd);

    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    const priceRange = maxPrice - minPrice;

    const drawableWidth = width - CHART_PADDING * 2;

    const drawableHeight = CHART_HEIGHT - CHART_PADDING * 2;

    return validPoints.map((point, index): ChartPoint => {
      const x =
        CHART_PADDING + (index / (validPoints.length - 1)) * drawableWidth;

      const normalizedPrice =
        priceRange === 0 ? 0.5 : (point.priceUsd - minPrice) / priceRange;

      const y = CHART_PADDING + (1 - normalizedPrice) * drawableHeight;

      return {
        x,
        y,
      };
    });
  }, [validPoints, width]);

  if (validPoints.length < 2) {
    return (
      <View style={styles.empty}>
        <AppText variant="caption" tone="muted">
          Price data unavailable
        </AppText>
      </View>
    );
  }

  return (
    <View
      style={styles.container}
      onLayout={(event) => {
        setWidth(event.nativeEvent.layout.width);
      }}
    >
      {width > 0 &&
        chartPoints.slice(0, -1).map((point, index) => {
          const nextPoint = chartPoints[index + 1];

          const deltaX = nextPoint.x - point.x;

          const deltaY = nextPoint.y - point.y;

          const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

          const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);

          return (
            <View
              key={index}
              style={[
                styles.line,
                {
                  width: length,
                  left: point.x,
                  top: point.y,
                  transform: [
                    {
                      rotate: `${angle}deg`,
                    },
                  ],
                },
              ]}
            />
          );
        })}
    </View>
  );
}
