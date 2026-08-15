import { Pressable, View } from "react-native";

import { AssetIcon } from "@/components/asset-icon";
import { AppText } from "@/components/ui/text";

import type { WatchRowObservation } from "@/core/watchlist/observation";
import type { WatchedToken } from "@/core/watchlist/types";

import { formatUsd, shortenAddress } from "@/utils/format";

import { styles } from "./watchlist-row.styles";

export type WatchlistRowData = {
  token: WatchedToken;

  symbol: string | null;

  name: string | null;

  logo: string | null;

  // The entry was saved for a different network than this build runs on. It
  // stays on the list — it is the user's — but nothing here can describe it.
  offNetwork: boolean;

  observation: WatchRowObservation;
};

function describeAge(checkedAt: number | null, now: number): string | null {
  if (checkedAt === null) {
    return null;
  }

  const seconds = Math.max(0, Math.round((now - checkedAt) / 1000));

  if (seconds < 60) {
    return "Checked just now";
  }

  const minutes = Math.round(seconds / 60);

  if (minutes < 60) {
    return `Checked ${minutes}m ago`;
  }

  return `Checked ${Math.round(minutes / 60)}h ago`;
}

// Every state gets words, not just a colour, and none of them upgrades an
// absence into reassurance.
function describeStatus(observation: WatchRowObservation): {
  text: string;
  tone: "muted" | "warning" | "danger";
} {
  switch (observation.status) {
    case "idle":
      return { text: "Not checked yet", tone: "muted" };

    case "checking":
      return { text: "Checking…", tone: "muted" };

    case "refreshing":
      return { text: "Refreshing…", tone: "muted" };

    case "current":
      return { text: "Up to date", tone: "muted" };

    case "stale":
      return { text: "Last known result — not rechecked yet", tone: "warning" };

    case "partial":
      return { text: "Some checks unavailable", tone: "warning" };

    case "unavailable":
      return { text: "Risk status unavailable", tone: "warning" };

    case "unsupported":
      return { text: "Risk checks not supported on this network", tone: "muted" };
  }
}

function riskTone(kind: WatchRowObservation["riskKind"]) {
  if (kind === "critical") {
    return "danger" as const;
  }

  if (kind === "high") {
    return "danger" as const;
  }

  if (kind === "incomplete") {
    return "warning" as const;
  }

  return "muted" as const;
}

export function WatchlistRow({
  row,
  now,
  onOpen,
  onRemove,
}: {
  row: WatchlistRowData;

  now: number;

  onOpen: () => void;

  // Removal lives on the row, not only behind the token screen: an entry saved
  // for another network cannot open that screen at all, and without this it
  // would be impossible to take off the list while still using up a slot.
  onRemove: () => void;
}) {
  const status = describeStatus(row.observation);

  const age = describeAge(row.observation.checkedAt, now);

  const title = row.symbol ?? shortenAddress(row.token.address);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${title} details`}
      onPress={onOpen}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.top}>
        <AssetIcon
          type="erc20"
          symbol={row.symbol ?? "?"}
          logo={row.logo}
          size={40}
        />

        <View style={styles.identity}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {title}
          </AppText>

          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {row.name ??
              (row.offNetwork ? "Saved on another network" : "Token metadata unavailable")}
          </AppText>
        </View>

        <View style={styles.amounts}>
          {/* Nothing was asked for an off-network entry, so nothing is claimed
              about it here — not even that a price is unavailable. */}
          {row.offNetwork ? null : row.observation.priceUsd.known ? (
            <AppText variant="bodyStrong" tabular>
              {formatUsd(row.observation.priceUsd.value)}
            </AppText>
          ) : (
            <AppText variant="caption" tone="muted">
              Price unavailable
            </AppText>
          )}
        </View>
      </View>

      <View style={styles.details}>
        {row.offNetwork && (
          <AppText variant="caption" tone="warning">
            Saved on another network — not checked here
          </AppText>
        )}

        {!row.offNetwork && row.observation.riskTitle && (
          <AppText variant="caption" tone={riskTone(row.observation.riskKind)}>
            {row.observation.riskTitle}
          </AppText>
        )}

        {!row.offNetwork && (
          <>
            <AppText variant="caption" tone="muted">
              {row.observation.liquidityUsd.known
                ? `Liquidity ${formatUsd(row.observation.liquidityUsd.value)}`
                : "Liquidity unavailable"}
            </AppText>

            {/* Pinned to one line: the longest wording plus an age stamp wraps
                on a phone, and a row that grows a line when its first result
                lands is the layout shift the reserved height exists to stop. */}
            <AppText variant="caption" tone={status.tone} numberOfLines={1}>
              {status.text}
              {age ? ` · ${age}` : ""}
            </AppText>
          </>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${title} from watchlist`}
          onPress={(event) => {
            // The row itself opens the token; this must not do both.
            event.stopPropagation?.();

            onRemove();
          }}
          style={({ pressed }) => [
            styles.removeButton,
            pressed && styles.removeButtonPressed,
          ]}
        >
          <AppText variant="caption" tone="muted">
            Remove
          </AppText>
        </Pressable>
      </View>
    </Pressable>
  );
}
