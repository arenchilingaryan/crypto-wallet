import { formatEther, formatUnits, type Address } from "viem";

import { resolveDirection, type ActivityItem } from "./activity";

import type { TrackedTransaction } from "@/core/transactions/trackedTransaction";

import { addDecimalAmounts, isPositiveAmount } from "./decimalAmount";

function creditedFromChain(
  transaction: TrackedTransaction,
  chainActivity: ActivityItem[],
  wallet: string,
): string | null {
  if (transaction.assetType !== "swap") {
    return null;
  }

  const symbolOut = transaction.symbolOut?.toLowerCase();

  if (!symbolOut) {
    return null;
  }

  const tokenOut = transaction.contractAddressOut?.toLowerCase() ?? null;

  const credits = chainActivity.filter((item) => {
    if (
      item.hash.toLowerCase() !== transaction.hash.toLowerCase() ||
      item.to?.toLowerCase() !== wallet
    ) {
      return false;
    }

    return tokenOut === null
      ? item.assetType === "native" && item.symbol.toLowerCase() === symbolOut
      : item.contractAddress?.toLowerCase() === tokenOut;
  });

  if (credits.length === 0) {
    return null;
  }

  const total = addDecimalAmounts(credits.map((item) => item.amount));

  return total !== null && isPositiveAmount(total) ? total : null;
}

function trackedToActivity(
  transaction: TrackedTransaction,
  walletAddress: Address,
  credited: string | null,
): ActivityItem | null {
  const wallet = walletAddress.toLowerCase();

  const isSender = transaction.from.toLowerCase() === wallet;

  const isReceiver = transaction.to.toLowerCase() === wallet;

  if (!isSender && !isReceiver) {
    return null;
  }

  const amount =
    transaction.assetType === "native"
      ? formatEther(BigInt(transaction.valueWei))
      : formatUnits(
          BigInt(transaction.valueWei),
          transaction.tokenDecimals ?? 18,
        );

  return {
    id: `local:${transaction.hash}`,

    hash: transaction.hash,

    status: transaction.status,

    direction: resolveDirection(
      transaction.from,
      transaction.to,
      walletAddress,
    ),

    origin: "wallet-signed",

    assetType: transaction.assetType,

    symbol: transaction.symbol,

    amount,

    from: transaction.from,

    to: transaction.to,

    contractAddress:
      transaction.assetType === "native"
        ? null
        : (transaction.contractAddress ?? null),

    blockNumber: transaction.blockNumber
      ? BigInt(transaction.blockNumber)
      : null,

    timestamp: transaction.createdAt,

    symbolOut: transaction.symbolOut,

    amountOut:
      credited ??
      (transaction.valueOutWei !== undefined
        ? formatUnits(
            BigInt(transaction.valueOutWei),
            transaction.tokenOutDecimals ?? 18,
          )
        : undefined),

    amountOutIsQuote:
      credited === null && transaction.valueOutWei !== undefined,
  };
}

export function mergeActivity(
  chainActivity: ActivityItem[],
  tracked: TrackedTransaction[],
  walletAddress: Address,
): ActivityItem[] {
  const wallet = walletAddress.toLowerCase();

  const local = tracked
    .map((transaction) =>
      trackedToActivity(
        transaction,
        walletAddress,
        creditedFromChain(transaction, chainActivity, wallet),
      ),
    )
    .filter((item): item is ActivityItem => item !== null);

  const trackedHashes = new Set(local.map((item) => item.hash.toLowerCase()));

  const remoteWithoutDuplicates = chainActivity.filter(
    (item) => !trackedHashes.has(item.hash.toLowerCase()),
  );

  return [...local, ...remoteWithoutDuplicates].sort(
    (a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0),
  );
}
