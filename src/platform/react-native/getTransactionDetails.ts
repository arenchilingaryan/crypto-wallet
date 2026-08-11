import type { Hash, TransactionReceipt } from "viem";

import { ACTIVE_NETWORK } from "@/constants/networks";

import type { TransactionDetails } from "@/core/transactions/transactionDetails";

import { ethereumPublicClient } from "./ethereumPublicClient";
import { getTrackedTransaction } from "./trackedTransactionStore";

export async function getTransactionDetails(
  hash: Hash,
): Promise<TransactionDetails> {
  const tracked = await getTrackedTransaction(hash);

  let transaction;

  try {
    transaction = await ethereumPublicClient.getTransaction({
      hash,
    });
  } catch {
    if (!tracked) {
      throw new Error("Transaction not found");
    }

    return {
      hash,

      status: tracked.status,

      network: ACTIVE_NETWORK.name,

      chainId: tracked.chainId,

      from: tracked.from,

      to: tracked.to,

      valueWei: BigInt(tracked.valueWei),

      gasUsed: tracked.gasUsed ? BigInt(tracked.gasUsed) : null,

      gasPriceWei: tracked.effectiveGasPriceWei
        ? BigInt(tracked.effectiveGasPriceWei)
        : null,

      networkFeeWei:
        tracked.gasUsed && tracked.effectiveGasPriceWei
          ? BigInt(tracked.gasUsed) * BigInt(tracked.effectiveGasPriceWei)
          : null,

      blockNumber: tracked.blockNumber ? BigInt(tracked.blockNumber) : null,

      timestamp: tracked.confirmedAt ?? tracked.createdAt,
    };
  }

  let receipt: TransactionReceipt | null = null;

  try {
    receipt = await ethereumPublicClient.getTransactionReceipt({
      hash,
    });
  } catch {
    receipt = null;
  }

  let timestamp: number | null = null;

  if (receipt?.blockNumber) {
    try {
      const block = await ethereumPublicClient.getBlock({
        blockNumber: receipt.blockNumber,
      });

      timestamp = Number(block.timestamp) * 1000;
    } catch {
      timestamp = tracked?.confirmedAt ?? tracked?.createdAt ?? null;
    }
  }

  const gasUsed = receipt?.gasUsed ?? null;

  const gasPriceWei = receipt?.effectiveGasPrice ?? null;

  const networkFeeWei =
    gasUsed !== null && gasPriceWei !== null ? gasUsed * gasPriceWei : null;

  const status =
    receipt === null
      ? "pending"
      : receipt.status === "success"
        ? "confirmed"
        : "reverted";

  return {
    hash,

    status,

    network: ACTIVE_NETWORK.name,

    chainId: transaction.chainId ?? tracked?.chainId ?? ACTIVE_NETWORK.chain.id,

    from: transaction.from,

    to: transaction.to,

    valueWei: transaction.value,

    gasUsed,

    gasPriceWei,

    networkFeeWei,

    blockNumber: receipt?.blockNumber ?? transaction.blockNumber ?? null,

    timestamp: timestamp ?? tracked?.createdAt ?? null,
  };
}
