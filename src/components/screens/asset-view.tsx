import { Image } from "expo-image";
import { Pressable, View } from "react-native";

import { Screen } from "@/components/ui/screen";
import { AppText } from "@/components/ui/text";
import type { PortfolioAsset } from "@/core/blockchain/getPortfolio";
import { formatTokenAmount, formatUsd } from "@/utils/format";

import { PriceChart } from "@/components/charts/price-chart";
import type { AssetMarketData } from "@/core/blockchain/getAssetMarketData";

import { styles } from "./asset-view.styles.ts";

type AssetViewProps = {
  asset: PortfolioAsset;
  marketData: AssetMarketData | null;
  onReceive: () => void;
};

export function AssetView({ asset, marketData, onReceive }: AssetViewProps) {
  return (
    <Screen>
      <View style={styles.assetHeader}>
        <View style={styles.icon}>
          {asset.logo ? (
            <Image source={{ uri: asset.logo }} style={styles.logo} />
          ) : (
            <AppText variant="bodyStrong" tone="secondary">
              {asset.symbol.slice(0, 3)}
            </AppText>
          )}
        </View>

        <View>
          <AppText variant="heading">{asset.symbol}</AppText>

          <AppText variant="caption" tone="muted">
            {asset.name}
          </AppText>
        </View>
      </View>

      <View style={styles.price}>
        <AppText variant="overline" tone="muted">
          Price
        </AppText>

        <AppText variant="display" tabular>
          {marketData ? formatUsd(marketData.priceUsd) : "—"}
        </AppText>

        {marketData?.change24hPercent !== null &&
          marketData?.change24hPercent !== undefined && (
            <AppText
              variant="caption"
              tone={marketData.change24hPercent >= 0 ? "success" : "danger"}
              tabular
            >
              {marketData.change24hPercent >= 0 ? "+" : ""}
              {marketData.change24hPercent.toFixed(2)}%{"  "}24h
            </AppText>
          )}
      </View>

      <View style={styles.chart}>
        <PriceChart points={marketData?.points ?? []} />
      </View>

      <View style={styles.actions}>
        <ActionButton label="Receive" onPress={onReceive} />

        <ActionButton label="Send" disabled />

        <ActionButton label="Swap" disabled />
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
