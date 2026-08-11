import { formatEther, type Address } from "viem";

import type { ActivityItem } from "./activity";

import type { TrackedTransaction } from "@/core/transactions/trackedTransaction";

function trackedToActivity(
  transaction: TrackedTransaction,
  walletAddress: Address,
): ActivityItem | null {
  const wallet = walletAddress.toLowerCase();

  const isSender = transaction.from.toLowerCase() === wallet;

  const isReceiver = transaction.to.toLowerCase() === wallet;

  if (!isSender && !isReceiver) {
    return null;
  }

  return {
    id: `local:${transaction.hash}`,

    hash: transaction.hash,

    status: transaction.status,

    direction: isSender ? "sent" : "received",

    assetType: transaction.assetType,

    symbol: transaction.symbol,

    amount: formatEther(BigInt(transaction.valueWei)),

    from: transaction.from,

    to: transaction.to,

    contractAddress: null,

    blockNumber: transaction.blockNumber
      ? BigInt(transaction.blockNumber)
      : null,

    timestamp: transaction.createdAt,
  };
}

export function mergeActivity(
  chainActivity: ActivityItem[],
  tracked: TrackedTransaction[],
  walletAddress: Address,
): ActivityItem[] {
  const local = tracked
    .map((transaction) => trackedToActivity(transaction, walletAddress))
    .filter((item): item is ActivityItem => item !== null);

  const trackedHashes = new Set(local.map((item) => item.hash.toLowerCase()));

  const remoteWithoutDuplicates = chainActivity.filter(
    (item) => !trackedHashes.has(item.hash.toLowerCase()),
  );

  return [...local, ...remoteWithoutDuplicates].sort(
    (a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0),
  );
}
