import { View } from "react-native";

import { AppText } from "@/components/ui/text";
import type { TokenIntelligence } from "@/core/token-intelligence/types";
import { shortenAddress } from "@/utils/format";

import {
  evidenceSources,
  formatSources,
  formatTriState,
} from "./formatters";
import { FindingRow, MetricRow, SectionCard } from "./primitives";
import { styles } from "./token-intelligence.styles";

function ownerValue(value: TokenIntelligence["contractSafety"]["ownerAddress"]["value"]) {
  if (value === "unknown") {
    return "Unknown";
  }

  return shortenAddress(value);
}

export function ContractRiskCard({
  intelligence,
  onRetry,
}: {
  intelligence: TokenIntelligence;
  onRetry?: () => void;
}) {
  const contract = intelligence.contractSafety;

  return (
    <SectionCard
      title="Contract"
      status={intelligence.availability.contract}
      risk={contract.risk.level}
      unavailableMessage="Contract capabilities could not be checked."
      partialMessage="Only part of the configured contract evidence returned."
      onRetry={onRetry}
    >
      <View style={styles.rows}>
        {contract.isOpenSource.value === true ? (
          <FindingRow
            severity="low"
            title="Source code available"
            detail={`Source: ${evidenceSources(contract.isOpenSource)}`}
          />
        ) : contract.isOpenSource.value === false ? (
          <FindingRow
            severity="high"
            title="Source code not verified"
            detail={`Source: ${evidenceSources(contract.isOpenSource)}`}
          />
        ) : (
          <FindingRow severity="info" title="Source verification unknown" />
        )}

        {contract.risk.reasons.map((reason) => (
          <FindingRow
            key={`${reason.code}:${reason.message}`}
            severity={reason.level}
            title={reason.message}
            detail={
              reason.sources.length > 0
                ? `Source: ${formatSources(reason.sources)}`
                : undefined
            }
          />
        ))}

        {contract.otherPotentialRisks.map((risk) => (
          <FindingRow key={risk} severity="info" title={risk} detail="Reported by GoPlus" />
        ))}

        <View style={styles.divider} />

        <MetricRow
          label="Owner"
          value={ownerValue(contract.ownerAddress.value)}
          detail={evidenceSources(contract.ownerAddress)}
          mono={contract.ownerAddress.value !== "unknown"}
        />
        <MetricRow
          label="Upgradeable proxy"
          value={formatTriState(contract.isProxy.value, "Detected", "Not detected")}
          detail={evidenceSources(contract.isProxy)}
        />
        <MetricRow
          label="Mint capability"
          value={formatTriState(contract.isMintable.value, "Detected", "Not detected")}
          detail={evidenceSources(contract.isMintable)}
        />
        <MetricRow
          label="Transfer pause capability"
          value={formatTriState(contract.transferPausable.value, "Detected", "Not detected")}
          detail={evidenceSources(contract.transferPausable)}
        />
        <MetricRow
          label="Address blacklist"
          value={formatTriState(contract.isBlacklisted.value, "Detected", "Not detected")}
          detail={evidenceSources(contract.isBlacklisted)}
        />
      </View>

      {contract.note.value !== "unknown" ? (
        <View style={styles.evidence}>
          <AppText variant="label">Provider note</AppText>
          <AppText variant="caption" tone="muted">
            {contract.note.value}
          </AppText>
          <AppText variant="caption" tone="muted">
            {evidenceSources(contract.note)}
          </AppText>
        </View>
      ) : null}
    </SectionCard>
  );
}
