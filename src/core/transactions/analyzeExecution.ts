import { formatEther } from "viem";

import {
  addDecimalAmounts,
  isDecimalAmount,
} from "@/core/blockchain/decimalAmount";

import type { ExecutionFacts } from "./executionFacts";

export type ExecutionDeviation = {
  amount: string;

  worseThanQuote: boolean;
};

export type OutputProvenance = "receipt-logs" | "not-established";

export type ExecutionAnalysis = {
  amountIn: string;

  symbolIn: string;

  symbolOut: string;

  quoted: string | null;

  minimum: string | null;

  received: string | null;

  provenance: OutputProvenance;

  deviation: ExecutionDeviation | null;

  executionPrice: string | null;

  headroomOverFloor: string | null;

  gasNative: string | null;

  gasUsed: string | null;

  gasLimit: string | null;

  gasHeadroomPercent: number | null;

  route: string | null;

  nativeSymbol: string;

  secondsToConfirm: number | null;

  unresolved: string[];
};

function negate(value: string) {
  return value.startsWith("-") ? value.slice(1) : `-${value}`;
}

export function subtractDecimalAmounts(
  left: string,
  right: string,
): string | null {
  if (!isDecimalAmount(left) || !isDecimalAmount(right)) {
    return null;
  }

  return addDecimalAmounts([left, negate(right)]);
}

function gasSpent(facts: ExecutionFacts): string | null {
  if (facts.gasUsed === null || facts.effectiveGasPriceWei === null) {
    return null;
  }

  try {
    return formatEther(BigInt(facts.gasUsed) * BigInt(facts.effectiveGasPriceWei));
  } catch {
    return null;
  }
}

export function quoteToBlockSeconds(
  quotedAt: number | null,
  blockTimestamp: number | null,
): number | null {
  if (
    quotedAt === null ||
    blockTimestamp === null ||
    !Number.isFinite(quotedAt) ||
    !Number.isFinite(blockTimestamp)
  ) {
    return null;
  }

  if (blockTimestamp < quotedAt) {
    return null;
  }

  return Math.round((blockTimestamp - quotedAt) / 1000);
}

export function analyzeExecution(facts: ExecutionFacts): ExecutionAnalysis {
  const unresolved: string[] = [];

  const received = facts.actualAmountOut;

  if (received === null) {
    unresolved.push("what actually arrived");
  }

  const quoted = facts.quotedAmountOut;

  if (quoted === null) {
    unresolved.push("what was quoted");
  }

  const deviation =
    received !== null && quoted !== null
      ? (() => {
          const difference = subtractDecimalAmounts(received, quoted);

          if (difference === null) {
            return null;
          }

          return {
            amount: difference,

            worseThanQuote: difference.startsWith("-"),
          };
        })()
      : null;

  const gasNative = gasSpent(facts);

  if (gasNative === null) {
    unresolved.push("what the network fee cost");
  }

  const secondsToConfirm = quoteToBlockSeconds(
    facts.quotedAt,
    facts.confirmedAt,
  );

  const headroomOverFloor =
    received !== null && facts.minAmountOut !== null
      ? subtractDecimalAmounts(received, facts.minAmountOut)
      : null;

  const gasHeadroomPercent =
    facts.gasUsed !== null && facts.gasLimit !== null
      ? (() => {
          try {
            const used = BigInt(facts.gasUsed);

            const limit = BigInt(facts.gasLimit);

            if (limit <= 0n) {
              return null;
            }

            return Number((used * 10000n) / limit) / 100;
          } catch {
            return null;
          }
        })()
      : null;

  return {
    amountIn: facts.amountIn,

    symbolIn: facts.symbolIn,

    symbolOut: facts.symbolOut,

    quoted,

    minimum: facts.minAmountOut,

    received,

    provenance: received === null ? "not-established" : "receipt-logs",

    deviation,

    executionPrice: divideDecimalAmounts(received, facts.amountIn),

    headroomOverFloor,

    gasNative,

    gasUsed: facts.gasUsed,

    gasLimit: facts.gasLimit,

    gasHeadroomPercent,

    route: facts.route,

    nativeSymbol: facts.nativeSymbol,

    secondsToConfirm,

    unresolved,
  };
}

export function divideDecimalAmounts(
  numerator: string | null,
  denominator: string | null,
): string | null {
  if (
    numerator === null ||
    denominator === null ||
    !isDecimalAmount(numerator) ||
    !isDecimalAmount(denominator)
  ) {
    return null;
  }

  const top = Number(numerator);

  const bottom = Number(denominator);

  if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom === 0) {
    return null;
  }

  const result = top / bottom;

  if (!Number.isFinite(result)) {
    return null;
  }

  return result.toLocaleString("en-US", { maximumSignificantDigits: 8 });
}
