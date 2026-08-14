import type { Hash, TransactionReceipt } from "viem";

import { ACTIVE_NETWORK } from "@/constants/networks";

import {
  resolveDetailsAsset,
  type TransactionDetails,
} from "@/core/transactions/transactionDetails";

import { ethereumPublicClient } from "./ethereumPublicClient";
import { executionFromTracked } from "@/core/transactions/transactionDetails";
import {
  buildExecutionStory,
  type StoryKind,
} from "@/core/transactions/executionStory";

function storyKind(assetType: string): StoryKind {
  if (assetType === "swap") {
    return "swap";
  }

  return assetType === "approve" ? "approve" : "transfer";
}
import { getTrackedTransaction } from "./trackedTransactionStore";

export type ActivityHint = {
  symbol?: string;

  amount?: string;

  assetType?: string;

  symbolOut?: string;

  amountOut?: string;

  amountOutIsQuote?: boolean;
};


export async function getTransactionDetails(
  hash: Hash,
  hint?: ActivityHint,
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

      ...resolveDetailsAsset({
        tracked,
        hint: hint ?? null,
        chainValueWei: 0n,
        nativeSymbol: ACTIVE_NETWORK.nativeSymbol,
      }),

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


      execution: executionFromTracked(tracked, ACTIVE_NETWORK.nativeSymbol),

      story: buildExecutionStory({
        kind: storyKind(tracked.assetType),
        status: tracked.status,
        quotedAt: tracked.quotedAt ?? tracked.createdAt,
        broadcastAt: tracked.broadcastAt ?? null,
        confirmedAt: tracked.confirmedAt,
        blockNumber: tracked.blockNumber,
        hash,
      }),
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

    ...resolveDetailsAsset({
      tracked: tracked ?? null,
      hint: hint ?? null,
      chainValueWei: transaction.value,
      nativeSymbol: ACTIVE_NETWORK.nativeSymbol,
    }),

    gasUsed,

    gasPriceWei,

    networkFeeWei,

    blockNumber: receipt?.blockNumber ?? transaction.blockNumber ?? null,

    timestamp: timestamp ?? tracked?.createdAt ?? null,

    execution: executionFromTracked(tracked ?? null, ACTIVE_NETWORK.nativeSymbol),

    story: tracked
      ? buildExecutionStory({
          kind: storyKind(tracked.assetType),
          status: receipt === null ? tracked.status : status,
          quotedAt: tracked.quotedAt ?? tracked.createdAt,
          broadcastAt: tracked.broadcastAt ?? null,
          confirmedAt: timestamp ?? tracked.confirmedAt,
          blockNumber: receipt?.blockNumber?.toString() ?? tracked.blockNumber,
          hash,
        })
      : [],
  };
}
