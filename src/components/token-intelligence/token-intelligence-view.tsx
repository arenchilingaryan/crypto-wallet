import { View } from "react-native";

import type { TokenIntelligence } from "@/core/token-intelligence/types";

import { ContractRiskCard } from "./contract-risk-card";
import { DetectedRisksCard } from "./detected-risks-card";
import { EvidenceCard } from "./evidence-card";
import { HolderDistributionCard } from "./holder-distribution-card";
import { LiquidityCard } from "./liquidity-card";
import { SectionCard } from "./primitives";
import { TokenSafetySummary } from "./token-safety-summary";
import { styles } from "./token-intelligence.styles";
import { TopHoldersCard } from "./top-holders-card";
import { TradeSafetyCard } from "./trade-safety-card";
import { UnknownDataCard } from "./unknown-data-card";

export function TokenIntelligenceView({
  intelligence,
  onRetry,
  now,
  initialHolderCount,
}: {
  intelligence: TokenIntelligence;
  onRetry?: () => void;
  now?: number;
  initialHolderCount?: number;
}) {
  if (intelligence.availability.overall === "unsupported") {
    return (
      <SectionCard
        title="Token intelligence"
        status="unsupported"
        onRetry={onRetry}
      />
    );
  }

  return (
    <View style={styles.stack}>
      <TokenSafetySummary
        intelligence={intelligence}
        onRetry={onRetry}
        now={now}
      />

      <TradeSafetyCard intelligence={intelligence} onRetry={onRetry} />
      <ContractRiskCard intelligence={intelligence} onRetry={onRetry} />
      <HolderDistributionCard intelligence={intelligence} onRetry={onRetry} />
      <TopHoldersCard
        intelligence={intelligence}
        onRetry={onRetry}
        initialCount={initialHolderCount}
      />
      <LiquidityCard intelligence={intelligence} onRetry={onRetry} />
      <DetectedRisksCard intelligence={intelligence} />
      <EvidenceCard intelligence={intelligence} />
      <UnknownDataCard intelligence={intelligence} />
    </View>
  );
}
