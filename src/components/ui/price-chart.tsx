import { useId, useMemo, useRef, useState, type ElementRef } from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  View,
  type LayoutChangeEvent,
} from "react-native";
import Svg, { Defs, G, LinearGradient, Path, Stop } from "react-native-svg";

import { AppText } from "@/components/ui/text";
import { Colors } from "@/constants/theme";
import { formatUsd } from "@/utils/format";

import { CHART_HEIGHT, styles } from "./price-chart.styles";

export type ChartRange = "1H" | "1D" | "1W" | "1M" | "1Y";

export type PricePoint = {
  timestamp: number;
  priceUsd: number;
};

type PriceChartProps = {
  symbol: string;
  quoteSymbol?: string;
  priceUsd: number;
  changePercent: number | null;
  points: PricePoint[];
  range: ChartRange;
  /** New range is being fetched; the old series stays visible, dimmed. */
  loading?: boolean;
  onChangeRange?: (range: ChartRange) => void;
  availableRanges?: ChartRange[];
};

/** Keeps the stroke clear of the viewBox edges. */
const CHART_PAD_Y = 14;

/**
 * Series flatter than this fraction of its mid price render on a
 * proportionally compressed scale instead of stretching sensor noise
 * to full height — a stablecoin must not look like a volatile asset.
 */
const MIN_DOMAIN_FRACTION = 0.002;

const RANGES: ChartRange[] = ["1H", "1D", "1W", "1M", "1Y"];

/**
 * Steffen's monotone cubic interpolation. Smooth like a spline, but the
 * curve never overshoots the data: no invented highs or lows between
 * samples, plateaus stay flat. On dense series it converges to the
 * polyline. That is the correct tradeoff for financial data.
 */
function buildChart(points: PricePoint[], width: number) {
  if (points.length < 2 || width <= 0) {
    return {
      linePath: "",
      areaPath: "",
    };
  }

  const prices = points.map((point) => point.priceUsd);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const mid = (min + max) / 2;

  // Domain floor: a near-flat series must not fill the full height.
  const domainRange = Math.max(max - min, mid * MIN_DOMAIN_FRACTION);

  const innerHeight = CHART_HEIGHT - CHART_PAD_Y * 2;
  const stepX = width / (points.length - 1);

  const toY = (price: number) => {
    if (domainRange === 0) {
      return CHART_HEIGHT / 2;
    }

    const normalized = 0.5 + (price - mid) / domainRange;

    return CHART_PAD_Y + innerHeight * (1 - normalized);
  };

  const xs = points.map((_, index) => index * stepX);
  const ys = prices.map(toY);
  const count = points.length;

  // Secant slopes between neighbours, then Steffen-limited tangents.
  const secants: number[] = [];

  for (let index = 0; index < count - 1; index++) {
    secants.push((ys[index + 1] - ys[index]) / stepX);
  }

  const tangents: number[] = new Array(count);

  tangents[0] = secants[0];
  tangents[count - 1] = secants[count - 2];

  for (let index = 1; index < count - 1; index++) {
    const prev = secants[index - 1];
    const next = secants[index];

    if (prev * next <= 0) {
      // Local extremum in the data — tangent flattens, no overshoot.
      tangents[index] = 0;
      continue;
    }

    const average = (prev + next) / 2;

    tangents[index] =
      (Math.sign(prev) + Math.sign(next)) *
      Math.min(Math.abs(prev), Math.abs(next), Math.abs(average) / 2);
  }

  let linePath = `M ${xs[0]} ${ys[0]}`;

  for (let index = 0; index < count - 1; index++) {
    const thirdX = stepX / 3;

    const cp1x = xs[index] + thirdX;
    const cp1y = ys[index] + tangents[index] * thirdX;
    const cp2x = xs[index + 1] - thirdX;
    const cp2y = ys[index + 1] - tangents[index + 1] * thirdX;

    linePath += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${xs[index + 1]} ${ys[index + 1]}`;
  }

  const areaPath = `${linePath} L ${xs[count - 1]} ${CHART_HEIGHT} L ${xs[0]} ${CHART_HEIGHT} Z`;

  return {
    linePath,
    areaPath,
  };
}

/** Sub-cent tokens would render as "$0.00" through formatUsd. */
function formatPrice(priceUsd: number) {
  if (priceUsd > 0 && priceUsd < 0.01) {
    return `$${priceUsd.toLocaleString("en-US", {
      maximumSignificantDigits: 4,
    })}`;
  }

  return formatUsd(priceUsd);
}

function ChevronDown({ color, up = false }: { color: string; up?: boolean }) {
  return (
    <Svg
      width={12}
      height={12}
      viewBox="0 0 12 12"
      style={up ? { transform: [{ rotate: "180deg" }] } : undefined}
    >
      <Path
        d="M 3 4.5 L 6 7.5 L 9 4.5"
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function PriceChart({
  symbol,
  quoteSymbol = "USD",
  priceUsd,
  changePercent,
  points,
  range,
  loading = false,
  onChangeRange,
  availableRanges = RANGES,
}: PriceChartProps) {
  const [chartWidth, setChartWidth] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<{
    top: number;
    right: number;
  } | null>(null);

  const pillRef = useRef<ElementRef<typeof Pressable> | null>(null);

  const gradientId = `chart-fill-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  const { linePath, areaPath } = useMemo(
    () => buildChart(points, chartWidth),
    [points, chartWidth],
  );

  // Sign comes from the ROUNDED value, so the label and the line color
  // never disagree with the displayed digits. -0 normalises to +0.
  const displayChange =
    changePercent === null ? null : Number(changePercent.toFixed(2)) + 0;

  const neutral = displayChange === null || displayChange === 0;

  const lineColor = neutral
    ? Colors.textMuted
    : displayChange > 0
      ? Colors.success
      : Colors.danger;

  const changeTone = neutral
    ? "muted"
    : displayChange > 0
      ? "success"
      : "danger";

  const enabledRanges = RANGES.filter((item) =>
    availableRanges.includes(item),
  );

  function handleChartLayout(event: LayoutChangeEvent) {
    setChartWidth(event.nativeEvent.layout.width);
  }

  function openMenu() {
    if (enabledRanges.length < 2) {
      return;
    }

    pillRef.current?.measureInWindow((x, y, width, height) => {
      const windowWidth = Dimensions.get("window").width;

      setMenuAnchor({
        top: y + height + 4,
        right: Math.max(0, windowWidth - x - width),
      });
      setMenuOpen(true);
    });
  }

  function selectRange(item: ChartRange) {
    setMenuOpen(false);

    if (item !== range) {
      onChangeRange?.(item);
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.identity}>
          <AppText variant="label" tone="secondary">
            {symbol} / {quoteSymbol}
          </AppText>

          <AppText
            variant="display"
            tone="paper"
            tabular
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            style={styles.price}
          >
            {formatPrice(priceUsd)}
          </AppText>

          <AppText
            variant="label"
            tabular
            tone={changeTone}
            style={[styles.change, loading && styles.stale]}
          >
            {displayChange === null
              ? "—"
              : `${displayChange > 0 ? "+" : ""}${displayChange.toFixed(2)}%`}
          </AppText>
        </View>

        <Pressable
          ref={pillRef}
          onPress={openMenu}
          accessibilityRole="button"
          accessibilityLabel="Chart range"
          style={({ pressed }) => [styles.rangePill, pressed && styles.pressed]}
        >
          <AppText variant="label" tone="secondary">
            {range}
          </AppText>

          <ChevronDown color={Colors.textSecondary} up={menuOpen} />
        </Pressable>
      </View>

      <Modal
        visible={menuOpen}
        transparent
        statusBarTranslucent
        animationType="fade"
        onRequestClose={() => {
          setMenuOpen(false);
        }}
      >
        <Pressable
          style={styles.menuBackdrop}
          onPress={() => {
            setMenuOpen(false);
          }}
        >
          {menuAnchor && (
            <View
              style={[
                styles.menu,
                { top: menuAnchor.top, right: menuAnchor.right },
              ]}
            >
              {enabledRanges.map((item) => {
                const selected = item === range;

                return (
                  <Pressable
                    key={item}
                    onPress={() => {
                      selectRange(item);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    style={({ pressed }) => [
                      styles.menuItem,
                      selected && styles.menuItemActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <AppText
                      variant="label"
                      tone={selected ? "primary" : "secondary"}
                    >
                      {item}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          )}
        </Pressable>
      </Modal>

      <View style={styles.chartWrap} onLayout={handleChartLayout}>
        {points.length > 1 ? (
          chartWidth > 0 && (
            <Svg
              width="100%"
              height={CHART_HEIGHT}
              viewBox={`0 0 ${chartWidth} ${CHART_HEIGHT}`}
            >
              <Defs>
                <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor={lineColor} stopOpacity="0.16" />
                  <Stop offset="55%" stopColor={lineColor} stopOpacity="0.05" />
                  <Stop offset="100%" stopColor={lineColor} stopOpacity="0" />
                </LinearGradient>
              </Defs>

              <G opacity={loading ? 0.4 : 1}>
                <Path d={areaPath} fill={`url(#${gradientId})`} />
                <Path
                  d={linePath}
                  fill="none"
                  stroke={lineColor}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </G>
            </Svg>
          )
        ) : (
          <View style={styles.emptyChart}>
            <AppText variant="caption" tone="muted">
              Not enough market data
            </AppText>
          </View>
        )}
      </View>

      <View style={styles.ranges}>
        {RANGES.map((item) => {
          const selected = item === range;
          const enabled = availableRanges.includes(item);

          return (
            <Pressable
              key={item}
              disabled={!enabled}
              onPress={() => {
                onChangeRange?.(item);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled: !enabled }}
              hitSlop={{ top: 2, bottom: 2 }}
              style={({ pressed }) => [
                styles.rangeButton,
                selected && styles.rangeButtonActive,
                !enabled && styles.rangeButtonDisabled,
                pressed && enabled && styles.pressed,
              ]}
            >
              <AppText
                variant="label"
                tone={selected ? "primary" : "secondary"}
              >
                {item}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
