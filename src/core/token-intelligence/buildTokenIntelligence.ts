import {
  overallAvailability,
  providerObservedAt,
  sectionAvailability,
} from "./availability";
import { buildContractIntelligence } from "./contractRisk";
import { getFreshness } from "./freshness";
import { buildHolderDistribution } from "./holderDistribution";
import { buildLiquidityIntelligence } from "./liquidityRisk";
import { summarizeTokenRisk } from "./summarizeRisk";
import { buildTradeIntelligence } from "./tradeRisk";
import {
  UNKNOWN,
  type BuildTokenIntelligenceInput,
  type ProviderAvailability,
  type ProviderSnapshot,
  type TokenIntelligence,
} from "./types";

function providerAvailability<T>(
  snapshot: ProviderSnapshot<T>,
): ProviderAvailability {
  switch (snapshot.status) {
    case "available":
      return {
        status: "available",
        observedAt: snapshot.observedAt,
        reason: UNKNOWN,
      };
    case "loading":
      return {
        status: "loading",
        observedAt: UNKNOWN,
        reason: UNKNOWN,
      };
    case "unsupported":
      return {
        status: "unsupported",
        observedAt: UNKNOWN,
        reason: snapshot.reason,
      };
    case "unavailable":
      return {
        status: "unavailable",
        observedAt: UNKNOWN,
        reason: snapshot.reason,
      };
  }
}

function latestObservedAt(values: readonly (number | null)[]): number | typeof UNKNOWN {
  const known = values.filter((value): value is number => value !== null);

  return known.length > 0 ? Math.max(...known) : UNKNOWN;
}

export function buildTokenIntelligence(
  input: BuildTokenIntelligenceInput,
): TokenIntelligence {
  const { token, providers, now } = input;
  const tradeResult = buildTradeIntelligence({
    goplus: providers.goplus,
    honeypot: providers.honeypotCheck,
  });
  const contractResult = buildContractIntelligence({
    goplus: providers.goplus,
    honeypot: providers.honeypotCheck,
  });
  const holders = buildHolderDistribution({
    goplus: providers.goplus,
    honeypotCheck: providers.honeypotCheck,
    honeypotTopHolders: providers.honeypotTopHolders,
    now,
  });
  const liquidity = buildLiquidityIntelligence({
    goplus: providers.goplus,
    honeypot: providers.honeypotCheck,
  });
  const tradeAvailability = sectionAvailability(
    [providers.goplus, providers.honeypotCheck],
    2,
  );
  const contractAvailability = sectionAvailability(
    [providers.goplus, providers.honeypotCheck],
    2,
  );
  const holderAvailability = holders.availability;
  const liquidityAvailability = liquidity.availability;
  const sections = [
    tradeAvailability,
    contractAvailability,
    holderAvailability,
    liquidityAvailability,
  ] as const;
  const goplusObservedAt = providerObservedAt(providers.goplus);
  const honeypotObservedAt = providerObservedAt(providers.honeypotCheck);
  const topHoldersObservedAt = providerObservedAt(providers.honeypotTopHolders);
  const tradeObservedAt = latestObservedAt([
    goplusObservedAt,
    honeypotObservedAt,
  ]);
  const holderObservedAt = latestObservedAt([
    goplusObservedAt,
    honeypotObservedAt,
    topHoldersObservedAt,
  ]);
  const observedAt = latestObservedAt([
    goplusObservedAt,
    honeypotObservedAt,
    topHoldersObservedAt,
  ]);
  const summary = summarizeTokenRisk({
    trade: tradeResult.trade.risk,
    contract: contractResult.contract.risk,
    holders: holders.risk,
    liquidity: liquidity.risk,
    availability: sections,
  });

  return {
    token,
    tradeSafety: tradeResult.trade,
    contractSafety: contractResult.contract,
    holders,
    liquidity,
    summary,
    evidence: {
      conflicts: [
        ...tradeResult.conflicts,
        ...contractResult.conflicts,
        ...holders.conflicts,
      ],
    },
    availability: {
      overall: overallAvailability(sections),
      trade: tradeAvailability,
      contract: contractAvailability,
      holders: holderAvailability,
      liquidity: liquidityAvailability,
      providers: {
        goplus: providerAvailability(providers.goplus),
        "honeypot-check": providerAvailability(providers.honeypotCheck),
        "honeypot-top-holders": providerAvailability(
          providers.honeypotTopHolders,
        ),
      },
    },
    freshness: {
      trade: getFreshness(tradeObservedAt, "trade", now),
      contract: getFreshness(goplusObservedAt ?? UNKNOWN, "contract", now),
      holders: getFreshness(holderObservedAt, "holders", now),
      liquidity: getFreshness(tradeObservedAt, "liquidity", now),
    },
    observedAt,
  };
}
