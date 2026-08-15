import { ActivityIndicator, Pressable, TextInput, View } from "react-native";

import type { AssetSearchResult } from "@/core/blockchain/assetSearch";

import { Screen } from "@/components/ui/screen";
import { AppText } from "@/components/ui/text";

import { styles } from "./asset-picker-view.styles";

import { shortenAddress } from "@/utils/format";
import { SearchIcon } from "@/components/icons/search-icon";
import { Colors } from "@/constants/theme";
import { AssetIcon } from "../asset-icon";
import { BackIcon } from "../icons/back-icon";

type AssetPickerViewProps = {
  title: string;

  query: string;

  results: AssetSearchResult[];

  loading: boolean;

  error: string | null;

  // Membership is a local fact, independent of any provider refresh, so the
  // marker shows even when risk data is unavailable.
  isWatched?: (asset: AssetSearchResult) => boolean;

  // True when the watchlist could not be read at all. Without this the absence
  // of a star would quietly assert "not watching" for every row.
  watchUnavailable?: boolean;

  // True when the wider token catalogue could not be consulted. Without this,
  // "no assets found" would claim a token does not exist when in fact the
  // search never happened.
  catalogueUnavailable?: boolean;

  onChangeQuery: (value: string) => void;

  onSelect: (asset: AssetSearchResult) => void;

  onBack: () => void;
};

export function AssetPickerView({
  title,
  query,
  results,
  loading,
  error,
  isWatched,
  watchUnavailable = false,
  catalogueUnavailable = false,
  onChangeQuery,
  onSelect,
  onBack,
}: AssetPickerViewProps) {
  return (
    <Screen style={styles.screen}>
      <View style={styles.header}>
        {/* The screen that opened this picker knows where "back" belongs; this
            component deciding for itself is how a swap picker ended up
            returning to the wallet home instead of the screen behind it. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={onBack}
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

      {catalogueUnavailable && (
        <AppText variant="caption" tone="warning">
          Wider token search is unavailable right now — only assets this app
          already knows are listed. This is not a complete result.
        </AppText>
      )}

      {watchUnavailable && (
        <AppText variant="caption" tone="warning">
          Watchlist status unavailable — these results do not show whether you
          are watching them.
        </AppText>
      )}

      {!loading && !error && query.trim().length > 0 && results.length === 0 && (
        <View style={styles.empty}>
          {/* Only claim nothing matched when the search actually ran. */}
          <AppText variant="bodyStrong">
            {catalogueUnavailable ? "Nothing to show yet" : "No assets found"}
          </AppText>

          <AppText variant="caption" tone="muted">
            {catalogueUnavailable
              ? "The token search could not run, so this is not a result. Try again in a moment, or paste the contract address."
              : "Try another name, symbol or contract address."}
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

                    {!watchUnavailable && isWatched?.(asset) && (
                      // Paired with a word, never a lone coloured glyph.
                      <AppText variant="caption" tone="accent">
                        ★ Watching
                      </AppText>
                    )}

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
