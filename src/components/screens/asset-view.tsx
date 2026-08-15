import { router } from "expo-router";
import { Pressable, View } from "react-native";

import { AssetIcon } from "@/components/asset-icon";
import { TokenIntelligenceView } from "@/components/token-intelligence";
import { Screen } from "@/components/ui/screen";
import { AppText } from "@/components/ui/text";

import type {
  AssetMarketData,
  MarketRange,
} from "@/core/blockchain/getAssetMarketData";
import type { PortfolioAsset } from "@/core/blockchain/getPortfolio";
import type { TokenIntelligence } from "@/core/token-intelligence/types";
import type { WatchStatus } from "@/core/watchlist/watchlistStore";

import {
  formatBalanceAmount,
  formatTokenAmount,
  formatUsd,
} from "@/utils/format";

import { PriceChart } from "../ui/price-chart";
import { styles } from "./asset-view.styles";

type AssetViewProps = {
  asset: PortfolioAsset;
  marketData: AssetMarketData | null;
  range: MarketRange;
  marketPending: boolean;
  intelligence: TokenIntelligence | null;

  // Absent for assets that cannot be watched (the native coin has no contract
  // address, and identity here is chain + address).
  watch: {
    status: WatchStatus;

    pending: boolean;

    error: string | null;

    onToggle: () => void;
  } | null;

  onChangeRange: (range: MarketRange) => void;
  onRetryIntelligence: () => void;
  onReceive: () => void;
  onSwap: () => void;
  onBack: () => void;
};

export function AssetView({
  asset,
  marketData,
  range,
  marketPending,
  intelligence,
  watch,
  onChangeRange,
  onRetryIntelligence,
  onReceive,
  onSwap,
  onBack,
}: AssetViewProps) {
  const currentPriceUsd = asset.priceUsd ?? marketData?.priceUsd ?? null;

  const seriesPoints = marketData?.points ?? [];

  const chartPoints =
    currentPriceUsd !== null && seriesPoints.length > 0
      ? [
          ...seriesPoints,
          { timestamp: Date.now(), priceUsd: currentPriceUsd },
        ]
      : seriesPoints;

  const firstPriceUsd = chartPoints[0]?.priceUsd ?? null;
  const lastPriceUsd = chartPoints[chartPoints.length - 1]?.priceUsd ?? null;

  const changePercent =
    firstPriceUsd !== null && firstPriceUsd > 0 && lastPriceUsd !== null
      ? ((lastPriceUsd - firstPriceUsd) / firstPriceUsd) * 100
      : null;

  return (
    <Screen scroll onBack={onBack}>
      <View style={styles.assetHeader}>
        <AssetIcon
          type={asset.type}
          symbol={asset.symbol}
          logo={asset.logo}
          size={64}
        />

        <View style={styles.assetIdentity}>
          <AppText variant="heading">{asset.symbol}</AppText>

          <AppText variant="caption" tone="secondary">
            {asset.name}
          </AppText>
        </View>

        {watch && (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{
              selected: watch.status === "watching",
              busy: watch.pending,
              disabled: watch.status === "unreadable",
            }}
            accessibilityLabel={
              watch.status === "unreadable"
                ? "Watchlist status unavailable"
                : watch.status === "watching"
                  ? "Remove token from watchlist"
                  : "Add token to watchlist"
            }
            disabled={watch.pending || watch.status === "unreadable"}
            onPress={watch.onToggle}
            style={({ pressed }) => [
              styles.watchButton,
              pressed && styles.watchButtonPressed,
            ]}
          >
            {/* The star is never the only signal: the label carries the state
                for anyone who cannot rely on colour or shape — including the
                case where we could not read the list at all. */}
            <AppText
              variant="label"
              tone={
                watch.status === "watching"
                  ? "accent"
                  : watch.status === "unreadable"
                    ? "warning"
                    : "muted"
              }
            >
              {watch.status === "watching"
                ? "★ Watching"
                : watch.status === "unreadable"
                  ? "Watch status unavailable"
                  : "☆ Watch"}
            </AppText>
          </Pressable>
        )}
      </View>

      {watch?.error && (
        <AppText variant="caption" tone="danger" style={styles.watchError}>
          {watch.error}
        </AppText>
      )}

      {currentPriceUsd !== null ? (
        <PriceChart
          symbol={asset.symbol}
          quoteSymbol="USD"
          priceUsd={currentPriceUsd}
          changePercent={changePercent}
          points={chartPoints}
          range={range}
          loading={marketPending}
          onChangeRange={onChangeRange}
        />
      ) : (
        <View style={styles.chartUnavailable}>
          <AppText variant="caption" tone="muted">
            Market data unavailable
          </AppText>
        </View>
      )}

      <View style={styles.actions}>
        <ActionButton label="Receive" onPress={onReceive} />

        <ActionButton
          label="Send"
          onPress={() => {
            if (asset.type === "native") {
              router.push("/send/native");

              return;
            }

            if (!asset.contractAddress) {
              return;
            }

            router.push({
              pathname: "/send/erc20",
              params: {
                contract: asset.contractAddress,
              },
            });
          }}
        />

        <ActionButton
          label="Swap"
          onPress={onSwap}
        />
      </View>

      <View style={styles.details}>
        <View style={styles.detailRow}>
          <AppText variant="caption" tone="muted">
            Balance
          </AppText>

          <AppText
            variant="bodyStrong"
            tone={asset.decimalsKnown ? "primary" : "warning"}
            tabular
          >
            {asset.decimalsKnown
              ? `${formatTokenAmount(asset.balance)} ${asset.symbol}`
              : formatBalanceAmount(asset.balance, false)}
          </AppText>
        </View>

        <View style={styles.divider} />

        <View style={styles.detailRow}>
          <AppText variant="caption" tone="muted">
            Value
          </AppText>

          <AppText variant="bodyStrong" tabular>
            {asset.valueUsd !== null ? formatUsd(asset.valueUsd) : "—"}
          </AppText>
        </View>

        {asset.type === "erc20" && asset.contractAddress && (
          <>
            <View style={styles.divider} />

            <View style={styles.contract}>
              <AppText variant="caption" tone="muted">
                Contract
              </AppText>

              <AppText variant="caption" mono numberOfLines={1}>
                {asset.contractAddress}
              </AppText>
            </View>
          </>
        )}
      </View>

      {asset.type === "erc20" && intelligence ? (
        <View style={styles.intelligence}>
          <TokenIntelligenceView
            intelligence={intelligence}
            onRetry={onRetryIntelligence}
          />
        </View>
      ) : null}
    </Screen>
  );
}

type ActionButtonProps = {
  label: string;
  disabled?: boolean;
  onPress?: () => void;
};

function ActionButton({ label, disabled = false, onPress }: ActionButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.action,
        disabled && styles.actionDisabled,
        pressed && !disabled && styles.actionPressed,
      ]}
    >
      <AppText variant="label" tone={disabled ? "muted" : undefined}>
        {label}
      </AppText>
    </Pressable>
  );
}
