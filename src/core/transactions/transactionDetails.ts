import { formatUnits, type Address, type Hash } from "viem";

import { isDecimalAmount } from "@/core/blockchain/decimalAmount";

import {
  analyzeExecution,
  type ExecutionAnalysis,
} from "./analyzeExecution";
import { buildExecutionStory, type StoryStep } from "./executionStory";
import type { TrackedTransactionStatus } from "./trackedTransaction";
import { toDecimal } from "./executionFacts";

export type TransactionDetailsStatus =
  | "broadcast-pending"
  | "broadcast-unknown"
  | "pending"
  | "confirmed"
  | "reverted"
  | "superseded";

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

  story: StoryStep[];
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
    status: TrackedTransactionStatus;
    gasUsed: string | null;
    gasLimit?: string | null;
    routeLabel?: string | null;
    effectiveGasPriceWei: string | null;
    createdAt: number;
    quotedAt?: number | null;
    confirmedAt: number | null;
  } | null,
  nativeSymbol: string,
): ExecutionAnalysis | null {
  if (!tracked || tracked.assetType !== "swap") {
    return null;
  }

  if (tracked.status !== "confirmed" && tracked.status !== "reverted") {
    return null;
  }

  const amountIn = toDecimal(tracked.valueWei, tracked.tokenDecimals ?? 18);

  if (amountIn === null || !tracked.symbolOut) {
    return null;
  }

  const decimalsOut = tracked.tokenOutDecimals ?? 18;

  return analyzeExecution({
    amountIn,

    symbolIn: tracked.symbol,

    symbolOut: tracked.symbolOut,

    quotedAmountOut: toDecimal(tracked.valueOutWei ?? null, decimalsOut),

    minAmountOut: toDecimal(tracked.minAmountOutWei ?? null, decimalsOut),

    actualAmountOut: toDecimal(tracked.actualAmountOutWei ?? null, decimalsOut),

    gasUsed: tracked.gasUsed,

    gasLimit: tracked.gasLimit ?? null,

    route: tracked.routeLabel ?? null,

    effectiveGasPriceWei: tracked.effectiveGasPriceWei,

    nativeSymbol,

    quotedAt: tracked.quotedAt ?? tracked.createdAt,

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
