import { ActivityIndicator, Pressable, TextInput, View } from "react-native";

import type { AssetSearchResult } from "@/core/blockchain/assetSearch";

import { Screen } from "@/components/ui/screen";
import { AppText } from "@/components/ui/text";

import { styles } from "./asset-picker-view.styles";

import { SearchIcon } from "@/components/icons/search-icon";
import { Colors } from "@/constants/theme";
import { router } from "expo-router";
import { AssetIcon } from "../asset-icon";
import { BackIcon } from "../icons/back-icon";

type AssetPickerViewProps = {
  title: string;

  query: string;

  results: AssetSearchResult[];

  loading: boolean;

  error: string | null;

  onChangeQuery: (value: string) => void;

  onSelect: (asset: AssetSearchResult) => void;

  onBack: () => void;
};

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function AssetPickerView({
  title,
  query,
  results,
  loading,
  error,
  onChangeQuery,
  onSelect,
  onBack,
}: AssetPickerViewProps) {
  return (
    <Screen style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/");
            }
          }}
          style={styles.backButton}
        >
          <BackIcon size={22} color={Colors.textPrimary} />
        </Pressable>

        <AppText variant="heading">{title}</AppText>
      </View>

      <View style={styles.searchBox}>
        <SearchIcon size={20} color={Colors.textSecondary} />

        <TextInput
          value={query}
          onChangeText={onChangeQuery}
          placeholder="Search name, symbol or address"
          placeholderTextColor={Colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          style={styles.searchInput}
        />
      </View>

      {loading && (
        <View style={styles.loading}>
          <ActivityIndicator />

          <AppText variant="caption" tone="muted">
            Searching…
          </AppText>
        </View>
      )}

      {error && (
        <AppText variant="caption" tone="danger">
          {error}
        </AppText>
      )}

      {!loading && !error && query.trim().length > 0 && results.length === 0 && (
        <View style={styles.empty}>
          <AppText variant="bodyStrong">No assets found</AppText>

          <AppText variant="caption" tone="muted">
            Try another name, symbol or contract address.
          </AppText>
        </View>
      )}

      <View style={styles.list}>
        {results.map((asset) => {
          const key =
            asset.type === "native"
              ? "native"
              : (asset.contractAddress ?? asset.symbol);

          return (
            <Pressable
              key={key}
              onPress={() => {
                onSelect(asset);
              }}
              style={({ pressed }) => [styles.asset, pressed && styles.pressed]}
            >
              <View style={styles.assetIdentity}>
                <AssetIcon
                  symbol={asset.symbol}
                  logo={asset.logo}
                  type={asset.type}
                />

                <View style={styles.assetText}>
                  <View style={styles.assetTitle}>
                    <AppText variant="bodyStrong">{asset.symbol}</AppText>

                    {asset.source === "wallet" && (
                      <AppText variant="caption" tone="muted">
                        Wallet
                      </AppText>
                    )}
                  </View>

                  <AppText variant="caption" tone="secondary">
                    {asset.name}
                  </AppText>

                  {asset.contractAddress && (
                    <AppText variant="caption" tone="muted" mono>
                      {shortenAddress(asset.contractAddress)}
                    </AppText>
                  )}
                </View>
              </View>

              {asset.balance !== null && (
                <AppText variant="bodyStrong" tabular>
                  {asset.balance}
                </AppText>
              )}
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}
