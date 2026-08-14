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

export type ExecutionAnalysis = {
  amountIn: string;

  symbolIn: string;

  symbolOut: string;

  quoted: string | null;

  minimum: string | null;

  received: string | null;

  deviation: ExecutionDeviation | null;

  gasNative: string | null;

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

  const secondsToConfirm =
    facts.quotedAt !== null &&
    facts.confirmedAt !== null &&
    facts.confirmedAt >= facts.quotedAt
      ? Math.round((facts.confirmedAt - facts.quotedAt) / 1000)
      : null;

  return {
    amountIn: facts.amountIn,

    symbolIn: facts.symbolIn,

    symbolOut: facts.symbolOut,

    quoted,

    minimum: facts.minAmountOut,

    received,

    deviation,

    gasNative,

    nativeSymbol: facts.nativeSymbol,

    secondsToConfirm,

    unresolved,
  };
}
