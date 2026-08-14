import { ActivityIndicator, Pressable, View } from "react-native";

import { AssetIcon } from "@/components/asset-icon";
import { SearchIcon } from "@/components/icons/search-icon";
import { Screen } from "@/components/ui/screen";
import { AppText } from "@/components/ui/text";

import { Colors } from "@/constants/theme";

import type { MarketList, MarketToken } from "@/core/blockchain/getMarkets";

import { formatTokenPrice, formatUsdCompact } from "@/utils/format";

import { styles } from "./explore-view.styles";

type ExploreViewProps = {
  list: MarketList;

  markets: MarketToken[];

  loading: boolean;

  error: string | null;

  onChangeList: (list: MarketList) => void;

  onSelect: (market: MarketToken) => void;

  onSearch: () => void;
};

const LISTS: { key: MarketList; label: string }[] = [
  { key: "trending", label: "Trending" },
  { key: "top", label: "Top volume" },
];

function formatAge(days: number | null) {
  if (days === null) {
    return "age unknown";
  }

  if (days < 1) {
    return "new today";
  }

  if (days < 30) {
    return `${days}d old`;
  }

  if (days < 365) {
    return `${Math.floor(days / 30)}mo old`;
  }

  return `${Math.floor(days / 365)}y old`;
}

export function ExploreView({
  list,
  markets,
  loading,
  error,
  onChangeList,
  onSelect,
  onSearch,
}: ExploreViewProps) {
  return (
    <Screen scroll>
      <View style={styles.header}>
        <AppText variant="title" tone="paper">
          Explore
        </AppText>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Search assets"
          onPress={onSearch}
          style={styles.iconButton}
        >
          <SearchIcon size={20} color={Colors.textPrimary} />
        </Pressable>
      </View>

      <View style={styles.segments}>
        {LISTS.map((item) => {
          const active = item.key === list;

          return (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              onPress={() => onChangeList(item.key)}
              style={[styles.segment, active && styles.segmentActive]}
            >
              <AppText
                variant="label"
                tone={active ? "paper" : "muted"}
              >
                {item.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <AppText variant="caption" tone="muted" style={styles.notice}>
        Ranked by DEX pool activity. Check liquidity and pool age before
        trading — anyone can create a pool.
      </AppText>

      {loading && markets.length === 0 && (
        <View style={styles.state}>
          <ActivityIndicator color={Colors.textSecondary} />
        </View>
      )}

      {error && (
        <View style={styles.state}>
          <AppText variant="bodyStrong" tone="danger">
            {error}
          </AppText>

          <AppText variant="caption" tone="muted">
            Market data is unavailable right now.
          </AppText>
        </View>
      )}

      {!loading && !error && markets.length === 0 && (
        <View style={styles.state}>
          <AppText variant="bodyStrong">Nothing to show</AppText>

          <AppText variant="caption" tone="muted">
            This network has no indexed DEX pools.
          </AppText>
        </View>
      )}

      <View style={styles.list}>
        {markets.map((market, index) => (
          <Pressable
            key={market.address}
            onPress={() => onSelect(market)}
            style={({ pressed }) => [
              styles.row,
              index > 0 && styles.rowDivider,
              pressed && styles.rowPressed,
            ]}
          >
            <AssetIcon
              symbol={market.symbol}
              logo={market.logo}
              type="erc20"
              size={40}
            />

            <View style={styles.identity}>
              <AppText variant="bodyStrong" numberOfLines={1}>
                {market.symbol}
              </AppText>

              <View style={styles.metrics}>
                <AppText variant="caption" tone="muted" tabular>
                  Liq{" "}
                  {market.liquidityUsd !== null
                    ? formatUsdCompact(market.liquidityUsd)
                    : "—"}
                </AppText>

                <AppText variant="caption" tone="muted" tabular>
                  Vol{" "}
                  {market.volumeUsd24h !== null
                    ? formatUsdCompact(market.volumeUsd24h)
                    : "—"}
                </AppText>

                <AppText
                  variant="caption"
                  tone={
                    market.poolAgeDays !== null && market.poolAgeDays < 7
                      ? "warning"
                      : "muted"
                  }
                >
                  {formatAge(market.poolAgeDays)}
                </AppText>
              </View>
            </View>

            <View style={styles.amounts}>
              <AppText variant="bodyStrong" tabular>
                {market.priceUsd !== null
                  ? formatTokenPrice(market.priceUsd)
                  : "—"}
              </AppText>

              {market.changePercent24h !== null && (
                <AppText
                  variant="caption"
                  tone={market.changePercent24h >= 0 ? "success" : "danger"}
                  tabular
                >
                  {market.changePercent24h >= 0 ? "+" : ""}
                  {market.changePercent24h.toFixed(2)}%
                </AppText>
              )}
            </View>
          </Pressable>
        ))}
      </View>

      <View style={styles.footer} />
    </Screen>
  );
}
