import { Pressable, View } from "react-native";

import type { PortfolioAsset } from "@/core/blockchain/getPortfolio";
import { formatTokenAmount, formatUsd } from "@/utils/format";

import { AssetIcon } from "./asset-icon";
import { styles } from "./asset-row.styles";
import { AppText } from "./ui/text";

type AssetRowProps = {
  asset: PortfolioAsset;

  changePercent?: number | null;
  onPress?: () => void;
};

export function AssetRow({
  asset,
  changePercent = null,
  onPress,
}: AssetRowProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && onPress ? styles.pressed : undefined,
      ]}
    >
      <View style={styles.icon}>
        <AssetIcon symbol={asset.symbol} logo={asset.logo} type={asset.type} />
      </View>

      <View style={styles.name}>
        <AppText variant="bodyStrong">{asset.symbol}</AppText>

        <AppText variant="caption" tone="muted" numberOfLines={1}>
          {asset.name}
        </AppText>
      </View>

      <View style={styles.amounts}>
        <AppText variant="bodyStrong" tabular>
          {formatTokenAmount(asset.balance)}
        </AppText>

        <View style={styles.valueRow}>
          <AppText variant="caption" tone="muted" tabular>
            {asset.valueUsd !== null ? formatUsd(asset.valueUsd) : "—"}
          </AppText>

          {changePercent !== null && Number.isFinite(changePercent) && (
            <AppText
              variant="caption"
              tone={changePercent >= 0 ? "success" : "danger"}
              tabular
            >
              {changePercent >= 0 ? "+" : ""}
              {changePercent.toFixed(2)}%
            </AppText>
          )}
        </View>
      </View>
    </Pressable>
  );
}
