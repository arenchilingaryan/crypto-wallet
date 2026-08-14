import { Pressable, View } from "react-native";

import {
  presentActivity,
  type ActivityItem,
} from "@/core/blockchain/activity";
import { describeTrackedStatus } from "@/core/transactions/trackedTransaction";

import { AppText } from "@/components/ui/text";

import { Screen } from "@/components/ui/screen";

import { shortenAddress } from "@/utils/format";

import { styles } from "./activity-view.styles";

type ActivityViewProps = {
  items: ActivityItem[];

  loading: boolean;

  error: string | null;

  onSelect: (item: ActivityItem) => void;

  onBack?: () => void;
};

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
          const { title, counterparty, counterpartyLabel, amountSign, note } =
            presentActivity(item);

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

                {item.status !== "confirmed" && (
                  <AppText
                    variant="caption"
                    tone={item.status === "reverted" ? "danger" : "warning"}
                  >
                    {describeTrackedStatus(item.status)}
                  </AppText>
                )}

                {counterparty && counterpartyLabel && (
                  <AppText variant="caption" tone="muted" mono>
                    {counterpartyLabel} {shortenAddress(counterparty)}
                  </AppText>
                )}

                {note && (
                  <AppText variant="caption" tone="muted">
                    {note}
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
                      {amountSign}
                      {item.amount}
                    </AppText>

                    <AppText variant="caption" tone="secondary">
                      {item.symbol}
                    </AppText>

                    {item.assetType === "swap" && item.amountOut && (
                      <AppText
                        variant="caption"
                        tone={item.amountOutIsQuote ? "muted" : "success"}
                        tabular
                      >
                        {item.status === "reverted"
                          ? `${item.symbolOut} not received`
                          : item.amountOutIsQuote
                            ? `~${item.amountOut} ${item.symbolOut} quoted`
                            : `+${item.amountOut} ${item.symbolOut}`}
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
