import { Pressable, View } from "react-native";

import type { ActivityItem } from "@/core/blockchain/activity";

import { AppText } from "@/components/ui/text";

import { Screen } from "@/components/ui/screen";

import { styles } from "./activity-view.styles";

type ActivityViewProps = {
  items: ActivityItem[];

  loading: boolean;

  error: string | null;

  onSelect: (item: ActivityItem) => void;

  onBack?: () => void;
};

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatTime(timestamp: number | null) {
  if (!timestamp) {
    return "";
  }

  return new Date(timestamp).toLocaleString();
}

export function ActivityView({
  items,
  loading,
  error,
  onSelect,
  onBack,
}: ActivityViewProps) {
  return (
    <Screen style={styles.screen} onBack={onBack}>
      <View style={styles.header}>
        <AppText variant="heading">Activity</AppText>
      </View>

      {loading && (
        <AppText variant="caption" tone="muted">
          Loading activity…
        </AppText>
      )}

      {error && (
        <AppText variant="caption" tone="danger">
          {error}
        </AppText>
      )}

      {!loading && !error && items.length === 0 && (
        <View style={styles.empty}>
          <AppText variant="bodyStrong">No activity yet</AppText>

          <AppText variant="caption" tone="muted">
            Your transactions will appear here.
          </AppText>
        </View>
      )}

      <View style={styles.list}>
        {items.map((item) => {
          const sent = item.direction === "sent";

          const counterparty = sent ? item.to : item.from;

          const title =
            item.assetType === "swap"
              ? `Swapped ${item.symbol} → ${item.symbolOut ?? "?"}`
              : item.assetType === "approve"
                ? `Approved ${item.symbol}`
                : `${sent ? "Sent" : "Received"} ${item.symbol}`;

          return (
            <Pressable
              key={item.id}
              onPress={() => {
                onSelect(item);
              }}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={styles.left}>
                <AppText variant="bodyStrong">{title}</AppText>

                {item.assetType !== "swap" &&
                  item.assetType !== "approve" &&
                  counterparty && (
                    <AppText variant="caption" tone="muted" mono>
                      {sent ? "To " : "From "}
                      {shortenAddress(counterparty)}
                    </AppText>
                  )}

                <AppText variant="caption" tone="muted">
                  {formatTime(item.timestamp)}
                </AppText>
              </View>

              <View style={styles.right}>
                {item.assetType === "approve" ? (
                  <AppText variant="caption" tone="secondary" tabular>
                    for {item.amount} {item.symbol}
                  </AppText>
                ) : (
                  <>
                    <AppText variant="bodyStrong" tabular>
                      {item.assetType === "swap" ? "-" : sent ? "-" : "+"}
                      {item.amount}
                    </AppText>

                    <AppText variant="caption" tone="secondary">
                      {item.symbol}
                    </AppText>

                    {item.assetType === "swap" && item.amountOut && (
                      <AppText variant="caption" tone="success" tabular>
                        +{item.amountOut} {item.symbolOut}
                      </AppText>
                    )}
                  </>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}
