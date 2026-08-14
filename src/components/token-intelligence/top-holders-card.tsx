import { useState } from "react";
import { Pressable, View } from "react-native";

import { AppText } from "@/components/ui/text";
import type {
  HolderCategory,
  HolderRecord,
  TokenIntelligence,
} from "@/core/token-intelligence/types";
import { shortenAddress } from "@/utils/format";

import {
  evidenceSources,
  formatDate,
  formatPercent,
  formatRawBalance,
  formatTriState,
} from "./formatters";
import { MetricRow, SectionCard } from "./primitives";
import { styles } from "./token-intelligence.styles";

const CATEGORY_LABEL: Record<HolderCategory, string> = {
  wallet: "Wallet",
  contract: "Contract",
  liquidity_pool: "Pool",
  burn: "Burned",
  locked: "Locked",
  deployer: "Deployer",
  owner: "Owner",
  unknown_contract: "Unknown contract",
};

const LIQUID_CATEGORIES = new Set<HolderCategory>([
  "wallet",
  "contract",
  "deployer",
  "owner",
  "unknown_contract",
]);

function displayPercent(holder: HolderRecord) {
  return LIQUID_CATEGORIES.has(holder.category)
    ? holder.liquidPercent
    : holder.rawPercent;
}

function HolderDetails({ holder }: { holder: HolderRecord }) {
  const conflicts = [
    holder.evidence.rawBalance.conflict ? "raw balance" : null,
    holder.evidence.rawPercent.conflict ? "raw share" : null,
    holder.evidence.isContract.conflict ? "contract classification" : null,
    holder.evidence.isLocked.conflict ? "lock classification" : null,
  ].filter((value): value is string => value !== null);

  return (
    <View style={styles.holderDetails}>
      {conflicts.length > 0 ? (
        <AppText variant="caption" tone="danger">
          Providers disagree on {conflicts.join(", ")}. Both observations are
          listed in Conflicting evidence.
        </AppText>
      ) : null}

      <MetricRow label="Address" value={holder.address} mono />
      <MetricRow label="Raw balance" value={formatRawBalance(holder.rawBalance)} />
      <MetricRow label="Raw share" value={formatPercent(holder.rawPercent)} />
      <MetricRow label="Liquid balance" value={formatRawBalance(holder.liquidBalance)} />
      <MetricRow label="Liquid share" value={formatPercent(holder.liquidPercent)} />
      <MetricRow label="Proven locked" value={formatRawBalance(holder.lockedBalance)} />
      <MetricRow
        label="Contract"
        value={formatTriState(holder.isContract, "Yes", "No")}
      />
      <MetricRow label="Lock status" value={holder.lockStatus.replaceAll("-", " ")} />

      {holder.lockDetails.map((lock, index) => (
        <View key={`${holder.address}:lock:${index}`} style={styles.evidence}>
          <MetricRow label="Locked amount" value={formatRawBalance(lock.amount)} />
          <MetricRow label="Lock end" value={formatDate(lock.endTimeMs)} />
        </View>
      ))}

      <AppText variant="caption" tone="muted">
        Balance evidence: {evidenceSources(holder.evidence.rawBalance)}
      </AppText>
    </View>
  );
}

export function TopHoldersCard({
  intelligence,
  onRetry,
  initialCount = 6,
}: {
  intelligence: TokenIntelligence;
  onRetry?: () => void;
  initialCount?: number;
}) {
  const [showAll, setShowAll] = useState(false);
  const [expandedAddress, setExpandedAddress] = useState<string | null>(null);
  const records = showAll
    ? intelligence.holders.holders
    : intelligence.holders.holders.slice(0, initialCount);

  return (
    <SectionCard
      title="Top holders"
      subtitle="Tap a holder to inspect raw, liquid, and lock evidence"
      status={intelligence.availability.holders}
      unavailableMessage="Top-holder data could not be retrieved."
      partialMessage="The returned list is incomplete. Concentration metrics retain partial coverage."
      onRetry={onRetry}
    >
      {records.length === 0 ? (
        <AppText variant="bodyStrong">No holder records returned</AppText>
      ) : (
        <View style={styles.rows}>
          {records.map((holder, index) => {
            const expanded = expandedAddress === holder.address;
            const percent = displayPercent(holder);
            const percentLabel = formatPercent(percent);
            const shareKind = LIQUID_CATEGORIES.has(holder.category)
              ? "liquid"
              : "raw";

            return (
              <View key={holder.address.toLowerCase()}>
                {index > 0 ? <View style={styles.divider} /> : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Inspect ${
                    holder.label || shortenAddress(holder.address)
                  }, ${CATEGORY_LABEL[holder.category]}, ${percentLabel} ${shareKind} share`}
                  accessibilityState={{ expanded }}
                  onPress={() => {
                    setExpandedAddress(expanded ? null : holder.address);
                  }}
                  style={({ pressed }) => [styles.holder, pressed && styles.pressed]}
                >
                  <View style={styles.holderHeader}>
                    <View style={styles.holderIdentity}>
                      <AppText variant="bodyStrong" numberOfLines={1}>
                        {holder.label || shortenAddress(holder.address)}
                      </AppText>
                      <AppText variant="caption" tone="muted" mono>
                        {shortenAddress(holder.address)}
                      </AppText>
                      <View style={styles.category}>
                        <AppText variant="overline" tone="secondary">
                          {CATEGORY_LABEL[holder.category]}
                        </AppText>
                      </View>
                    </View>

                    <View style={styles.holderAmount}>
                      <AppText variant="bodyStrong" tabular>
                        {percentLabel}
                      </AppText>
                      <AppText variant="caption" tone="muted">
                        {shareKind}
                      </AppText>
                    </View>
                  </View>

                  {expanded ? <HolderDetails holder={holder} /> : null}
                </Pressable>
              </View>
            );
          })}
        </View>
      )}

      {intelligence.holders.holders.length > initialCount ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={showAll ? "Show fewer holders" : "Show all holders"}
          accessibilityState={{ expanded: showAll }}
          onPress={() => setShowAll((value) => !value)}
          style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
        >
          <AppText variant="label">
            {showAll
              ? "Show fewer"
              : `Show all ${intelligence.holders.holders.length}`}
          </AppText>
        </Pressable>
      ) : null}
    </SectionCard>
  );
}
