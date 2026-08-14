import type { PortfolioAsset } from "./getPortfolio";

export type PortfolioValuation =
  | {
      coverage: "complete";

      totalUsd: number;

      unvaluedSymbols: string[];
    }
  | {
      coverage: "partial";

      totalUsd: number;

      unvaluedSymbols: string[];
    }
  | {
      coverage: "unavailable";

      totalUsd: null;

      unvaluedSymbols: string[];
    };

function holdsNothing(asset: PortfolioAsset) {
  const balance = Number(asset.balance);

  return Number.isFinite(balance) && balance === 0;
}

export function valuePortfolio(assets: PortfolioAsset[]): PortfolioValuation {
  const unvaluedSymbols: string[] = [];

  let totalUsd = 0;

  let valuedCount = 0;

  let countedCount = 0;

  for (const asset of assets) {
    if (holdsNothing(asset)) {
      continue;
    }

    countedCount += 1;

    const value = asset.valueUsd;

    if (value === null || !Number.isFinite(value)) {
      unvaluedSymbols.push(asset.symbol);

      continue;
    }

    totalUsd += value;

    valuedCount += 1;
  }

  if (countedCount === 0) {
    return { coverage: "complete", totalUsd: 0, unvaluedSymbols: [] };
  }

  if (valuedCount === 0) {
    return { coverage: "unavailable", totalUsd: null, unvaluedSymbols };
  }

  if (unvaluedSymbols.length > 0) {
    return { coverage: "partial", totalUsd, unvaluedSymbols };
  }

  return { coverage: "complete", totalUsd, unvaluedSymbols: [] };
}

export function describeValuation(valuation: PortfolioValuation): string | null {
  switch (valuation.coverage) {
    case "complete":
      return null;

    case "partial":
      return `Excludes ${valuation.unvaluedSymbols.join(", ")}: no price available`;

    case "unavailable":
      return "No prices are available for what you hold, so this cannot be valued";
  }
}
