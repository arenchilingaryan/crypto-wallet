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

import { formatTokenAmount, formatUsd } from "@/utils/format";

import { PriceChart } from "../ui/price-chart";
import { styles } from "./asset-view.styles";

type AssetViewProps = {
  asset: PortfolioAsset;
  marketData: AssetMarketData | null;
  range: MarketRange;
  marketPending: boolean;
  intelligence: TokenIntelligence | null;
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
      </View>

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

          <AppText variant="bodyStrong" tabular>
            {formatTokenAmount(asset.balance)} {asset.symbol}
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
