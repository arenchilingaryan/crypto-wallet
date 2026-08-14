import { View } from "react-native";

import type {
  RiskReason,
  TokenIntelligence,
} from "@/core/token-intelligence/types";

import { formatSources } from "./formatters";
import { FindingRow, SectionCard } from "./primitives";
import { styles } from "./token-intelligence.styles";

type AxisReason = RiskReason & { axis: string };

const ORDER: Record<RiskReason["level"], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  info: 3,
};

function collectReasons(intelligence: TokenIntelligence) {
  const axes: { axis: string; reasons: readonly RiskReason[] }[] = [
    { axis: "Trade", reasons: intelligence.tradeSafety.risk.reasons },
    { axis: "Contract", reasons: intelligence.contractSafety.risk.reasons },
    { axis: "Holders", reasons: intelligence.holders.risk.reasons },
    { axis: "Liquidity", reasons: intelligence.liquidity.risk.reasons },
  ];
  const seen = new Set<string>();
  const result: AxisReason[] = [];

  for (const { axis, reasons } of axes) {
    for (const reason of reasons) {
      const key = `${reason.code}:${reason.message}`;

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      result.push({ ...reason, axis });
    }
  }

  return result.sort((left, right) => ORDER[left.level] - ORDER[right.level]);
}

export function DetectedRisksCard({
  intelligence,
}: {
  intelligence: TokenIntelligence;
}) {
  const reasons = collectReasons(intelligence);

  if (reasons.length === 0) {
    return null;
  }

  return (
    <SectionCard title="Detected risks">
      <View style={styles.rows}>
        {reasons.map((reason) => (
          <FindingRow
            key={`${reason.code}:${reason.message}`}
            severity={reason.level}
            title={reason.message}
            detail={`${reason.axis} · ${formatSources(reason.sources)}`}
          />
        ))}
      </View>
    </SectionCard>
  );
}
