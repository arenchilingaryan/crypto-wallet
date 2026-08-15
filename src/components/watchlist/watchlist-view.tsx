import { ActivityIndicator, Pressable, TextInput, View } from "react-native";

import { Screen } from "@/components/ui/screen";
import { AppText } from "@/components/ui/text";
import { Button } from "@/components/ui/button";

import { Colors } from "@/constants/theme";

import { WatchlistRow, type WatchlistRowData } from "./watchlist-row";
import { styles } from "./watchlist-view.styles";

type WatchlistViewProps = {
  // Null while membership itself is still being read.
  rows: WatchlistRowData[] | null;

  unreadable: string | null;

  // A failed action (a removal that could not be saved) is NOT the same as a
  // list that could not be read: one keeps the list on screen, the other has no
  // list to show. Collapsing them would hide every row over one failed tap.
  actionError: string | null;

  repaired: boolean;

  refreshing: boolean;

  query: string;

  now: number;

  onChangeQuery: (value: string) => void;

  onRefresh: () => void;

  onRetry: () => void;

  onOpen: (row: WatchlistRowData) => void;

  onRemove: (row: WatchlistRowData) => void;

  onExplore: () => void;

  onBack: () => void;
};

export function WatchlistView({
  rows,
  unreadable,
  actionError,
  repaired,
  refreshing,
  query,
  now,
  onChangeQuery,
  onRefresh,
  onRetry,
  onOpen,
  onRemove,
  onExplore,
  onBack,
}: WatchlistViewProps) {
  // A store we could not read is NOT an empty watchlist. Saying "empty" here
  // would tell the user they lost their list when in fact we simply failed to
  // open it.
  if (unreadable) {
    return (
      <Screen scroll onBack={onBack}>
        <AppText variant="title" tone="paper" style={styles.heading}>
          Watchlist
        </AppText>

        <View style={styles.state}>
          <AppText variant="bodyStrong" tone="danger">
            Watchlist could not be loaded
          </AppText>

          <AppText variant="caption" tone="muted">
            {unreadable}
          </AppText>

          <Button title="Retry" variant="secondary" onPress={onRetry} />
        </View>
      </Screen>
    );
  }

  if (rows === null) {
    return (
      <Screen scroll onBack={onBack}>
        <AppText variant="title" tone="paper" style={styles.heading}>
          Watchlist
        </AppText>

        <View style={styles.state}>
          <ActivityIndicator color={Colors.textSecondary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll onBack={onBack}>
      <AppText variant="title" tone="paper" style={styles.heading}>
        Watchlist
      </AppText>

      {rows.length === 0 && !query ? (
        <View style={styles.state}>
          <AppText variant="bodyStrong">Your watchlist is empty</AppText>

          <AppText variant="caption" tone="muted">
            Track tokens you&apos;re interested in without buying them.
          </AppText>

          <Button
            title="Explore tokens"
            variant="secondary"
            onPress={onExplore}
          />
        </View>
      ) : (
        <>
          <View style={styles.toolbar}>
            <AppText variant="caption" tone="muted">
              {rows.length} asset{rows.length === 1 ? "" : "s"}
            </AppText>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Refresh watchlist data"
              accessibilityState={{ busy: refreshing }}
              disabled={refreshing}
              onPress={onRefresh}
              style={({ pressed }) => [
                styles.refreshButton,
                pressed && styles.refreshButtonPressed,
              ]}
            >
              <AppText variant="label" tone={refreshing ? "muted" : "primary"}>
                {refreshing ? "Refreshing…" : "Refresh"}
              </AppText>
            </Pressable>
          </View>

          {actionError && (
            <AppText variant="caption" tone="danger" style={styles.notice}>
              {actionError}
            </AppText>
          )}

          {repaired && (
            <AppText variant="caption" tone="warning" style={styles.notice}>
              Some saved entries could not be read and were skipped. The rest of
              your watchlist is shown.
            </AppText>
          )}

          <TextInput
            accessibilityLabel="Search your watchlist"
            placeholder="Search by symbol, name or address"
            placeholderTextColor={Colors.textSecondary}
            value={query}
            onChangeText={onChangeQuery}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.search}
          />

          {rows.length === 0 ? (
            <View style={styles.state}>
              <AppText variant="bodyStrong">No matches</AppText>

              <AppText variant="caption" tone="muted">
                Nothing on your watchlist matches that search.
              </AppText>
            </View>
          ) : (
            <View style={styles.list}>
              {rows.map((row) => (
                <WatchlistRow
                  key={`${row.token.chainId}:${row.token.address}`}
                  row={row}
                  now={now}
                  onOpen={() => onOpen(row)}
                  onRemove={() => onRemove(row)}
                />
              ))}
            </View>
          )}
        </>
      )}

      <AppText variant="caption" tone="muted" style={styles.footerNote}>
        Watched tokens are checked while you use the app. This device does no
        background monitoring and sends no alerts.
      </AppText>
    </Screen>
  );
}
