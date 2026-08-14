import { formatUnits, type Address, type Hash } from "viem";

import { isDecimalAmount } from "@/core/blockchain/decimalAmount";

import {
  analyzeExecution,
  type ExecutionAnalysis,
} from "./analyzeExecution";
import { toDecimal } from "./executionFacts";

export type TransactionDetailsStatus = "pending" | "confirmed" | "reverted";

export type TransactionDetails = {
  hash: Hash;

  status: TransactionDetailsStatus;

  network: string;

  chainId: number;

  from: Address;

  to: Address | null;

  symbol: string;

  kind: "transfer" | "approve" | "swap";

  displayAmount: string;

  symbolOut: string | null;

  amountOut: string | null;

  amountOutIsQuote: boolean;

  gasUsed: bigint | null;

  gasPriceWei: bigint | null;

  networkFeeWei: bigint | null;

  blockNumber: bigint | null;

  timestamp: number | null;

  execution: ExecutionAnalysis | null;
};

export function executionFromTracked(
  tracked: {
    assetType: "native" | "erc20" | "swap" | "approve";
    symbol: string;
    symbolOut?: string;
    valueWei: string;
    tokenDecimals?: number;
    valueOutWei?: string;
    minAmountOutWei?: string | null;
    actualAmountOutWei?: string | null;
    tokenOutDecimals?: number;
    gasUsed: string | null;
    effectiveGasPriceWei: string | null;
    createdAt: number;
    confirmedAt: number | null;
  } | null,
  nativeSymbol: string,
): ExecutionAnalysis | null {
  if (!tracked || tracked.assetType !== "swap") {
    return null;
  }

  const decimalsOut = tracked.tokenOutDecimals ?? 18;

  return analyzeExecution({
    amountIn: toDecimal(tracked.valueWei, tracked.tokenDecimals ?? 18) ?? "0",

    symbolIn: tracked.symbol,

    symbolOut: tracked.symbolOut ?? "?",

    quotedAmountOut: toDecimal(tracked.valueOutWei ?? null, decimalsOut),

    minAmountOut: toDecimal(tracked.minAmountOutWei ?? null, decimalsOut),

    actualAmountOut: toDecimal(tracked.actualAmountOutWei ?? null, decimalsOut),

    gasUsed: tracked.gasUsed,

    effectiveGasPriceWei: tracked.effectiveGasPriceWei,

    nativeSymbol,

    quotedAt: tracked.createdAt,

    confirmedAt: tracked.confirmedAt,
  });
}

export type DetailsAsset = {
  symbol: string;

  displayAmount: string;

  kind: TransactionDetails["kind"];

  symbolOut: string | null;

  amountOut: string | null;

  amountOutIsQuote: boolean;
};

export type DetailsSources = {
  tracked: {
    assetType: "native" | "erc20" | "swap" | "approve";
    symbol: string;
    valueWei: string;
    tokenDecimals?: number;
    symbolOut?: string;
  } | null;

  hint: {
    symbol?: string;
    amount?: string;
    assetType?: string;
    symbolOut?: string;
    amountOut?: string;
    amountOutIsQuote?: boolean;
  } | null;

  chainValueWei: bigint;

  nativeSymbol: string;
};

function kindOf(assetType: string | undefined): TransactionDetails["kind"] {
  if (assetType === "approve") {
    return "approve";
  }

  return assetType === "swap" ? "swap" : "transfer";
}

export function resolveDetailsAsset({
  tracked,
  hint,
  chainValueWei,
  nativeSymbol,
}: DetailsSources): DetailsAsset {
  if (tracked) {
    const decimals =
      tracked.assetType === "native" ? 18 : (tracked.tokenDecimals ?? 18);

    return {
      symbol: tracked.symbol,

      displayAmount: formatUnits(BigInt(tracked.valueWei), decimals),

      kind: kindOf(tracked.assetType),

      symbolOut: tracked.symbolOut ?? null,

      amountOut: hint?.amountOut || null,

      amountOutIsQuote: hint?.amountOutIsQuote === true,
    };
  }

  const decimals = 18;

  const usableAmount =
    hint?.amount && isDecimalAmount(hint.amount) ? hint.amount : null;

  return {
    symbol: (usableAmount && hint?.symbol) || nativeSymbol,

    displayAmount:
      usableAmount ?? formatUnits(chainValueWei, decimals),

    kind: kindOf(hint?.assetType),

    symbolOut: hint?.symbolOut || null,

    amountOut: hint?.amountOut || null,

    amountOutIsQuote: hint?.amountOutIsQuote === true,
  };
}
