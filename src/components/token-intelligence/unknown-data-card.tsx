import { View } from "react-native";

import { AppText } from "@/components/ui/text";
import type {
  Availability,
  TokenIntelligence,
} from "@/core/token-intelligence/types";

import { FindingRow, SectionCard } from "./primitives";
import { styles } from "./token-intelligence.styles";

function collectUnknowns(intelligence: TokenIntelligence) {
  const facts: { label: string; value: unknown; status: Availability }[] = [
    {
      label: "Token symbol",
      value: intelligence.token.symbol,
      status: intelligence.availability.overall,
    },
  ];
  const add = (
    status: Availability,
    entries: readonly (readonly [string, unknown])[],
  ) => {
    if (status === "loading") {
      return;
    }

    for (const [label, value] of entries) {
      facts.push({ label, value, status });
    }
  };

  add(intelligence.availability.trade, [
    ["Trade simulation", intelligence.tradeSafety.simulationSuccess.value],
    ["Honeypot result", intelligence.tradeSafety.honeypot.value],
    ["Buy tax", intelligence.tradeSafety.buyTaxPercent.value],
    ["Sell tax", intelligence.tradeSafety.sellTaxPercent.value],
    ["Transfer tax", intelligence.tradeSafety.transferTaxPercent.value],
    ["Cannot buy", intelligence.tradeSafety.cannotBuy.value],
    ["Cannot sell full balance", intelligence.tradeSafety.cannotSellAll.value],
    ["Tax modifiable", intelligence.tradeSafety.slippageModifiable.value],
    [
      "Address-specific tax modifiable",
      intelligence.tradeSafety.personalSlippageModifiable.value,
    ],
    ["Transfers pausable", intelligence.tradeSafety.transferPausable.value],
    ["Trading cooldown", intelligence.tradeSafety.tradingCooldown.value],
    ["Maximum buy restriction", intelligence.tradeSafety.hasMaxBuyRestriction.value],
    ["Maximum sell restriction", intelligence.tradeSafety.hasMaxSellRestriction.value],
  ]);
  add(intelligence.availability.contract, [
    ["Contract source", intelligence.contractSafety.isOpenSource.value],
    ["Root contract source", intelligence.contractSafety.rootOpenSource.value],
    ["Proxy status", intelligence.contractSafety.isProxy.value],
    ["Proxy calls", intelligence.contractSafety.hasProxyCalls.value],
    ["Mint capability", intelligence.contractSafety.isMintable.value],
    ["Contract owner", intelligence.contractSafety.ownerAddress.value],
    ["Hidden owner", intelligence.contractSafety.hiddenOwner.value],
    [
      "Ownership reclaim capability",
      intelligence.contractSafety.canTakeBackOwnership.value,
    ],
    [
      "Owner balance-change capability",
      intelligence.contractSafety.ownerChangeBalance.value,
    ],
    ["Self-destruct capability", intelligence.contractSafety.selfDestruct.value],
    ["External-call capability", intelligence.contractSafety.externalCall.value],
    ["Address blacklist", intelligence.contractSafety.isBlacklisted.value],
    ["Anti-whale mechanism", intelligence.contractSafety.antiWhale.value],
    [
      "Anti-whale controls modifiable",
      intelligence.contractSafety.antiWhaleModifiable.value,
    ],
    ["Airdrop scam signal", intelligence.contractSafety.isAirdropScam.value],
    ["Counterfeit-token signal", intelligence.contractSafety.fakeToken.value],
  ]);
  add(intelligence.availability.holders, [
    ["Total holders", intelligence.holders.metrics.totalHolders.value],
    [
      "Largest liquid holder",
      intelligence.holders.metrics.largestLiquidHolderPercent.value,
    ],
    ["Top 5 liquid holders", intelligence.holders.metrics.top5LiquidPercent.value],
    ["Top 10 liquid holders", intelligence.holders.metrics.top10LiquidPercent.value],
    ["Deployer share", intelligence.holders.metrics.deployerPercent.value],
    ["Owner share", intelligence.holders.metrics.ownerPercent.value],
    ["Burned share", intelligence.holders.metrics.burnPercent.value],
    ["Liquidity-pool share", intelligence.holders.metrics.liquidityPoolPercent.value],
    ["Known locked share", intelligence.holders.metrics.knownLockedPercent.value],
  ]);
  add(intelligence.availability.liquidity, [
    ["Total liquidity", intelligence.liquidity.totalLiquidityUsd.value],
  ]);

  return facts
    .filter(({ value, status }) => value === "unknown" && status !== "loading")
    .map(({ label, status }) => ({
      label,
      detail:
        status === "unsupported"
          ? "Unsupported on this network"
          : status === "unavailable"
            ? "Provider unavailable"
            : "Not returned",
    }));
}

export function UnknownDataCard({ intelligence }: { intelligence: TokenIntelligence }) {
  const unknowns = collectUnknowns(intelligence);

  if (unknowns.length === 0) {
    return null;
  }

  return (
    <SectionCard title="Unknown data" risk="unknown">
      <AppText variant="caption" tone="muted">
        Missing facts are not treated as zero, false, or low risk.
      </AppText>
      <View style={styles.rows}>
        {unknowns.map((fact) => (
          <FindingRow
            key={fact.label}
            severity="info"
            title={fact.label}
            detail={fact.detail}
          />
        ))}
      </View>
    </SectionCard>
  );
}
