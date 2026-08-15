import { keccak256, type Hash, type Hex } from "viem";

import { ACTIVE_NETWORK } from "@/constants/networks";

import type { PreparedErc20Approve } from "@/core/transactions/erc20Approve";
import type { PreparedErc20Transfer } from "@/core/transactions/erc20Transfer";
import type { PreparedNativeTransfer } from "@/core/transactions/nativeTransfer";
import type { PreparedSwap } from "@/core/transactions/swap";

import {
  isAwaitingChain,
  type TrackedTransaction,
  type TrackedTransactionStatus,
} from "@/core/transactions/trackedTransaction";
import { creditedFromLogs } from "@/core/transactions/executionFacts";
import {
  resolveBroadcast,
  type TransactionPresence,
} from "@/core/transactions/resolveBroadcast";
import { describeSwapRoute } from "@/core/transactions/createSwapPreview";

import { walletEngine } from "./compositionRoot";

import { ethereumPublicClient } from "./ethereumPublicClient";

import { priceTag } from "./priceLookup";

import {
  listTrackedTransactions,
  saveTrackedTransaction,
  updateTrackedTransaction,
} from "./trackedTransactionStore";

// Only the node's dedicated "there is no such transaction" answer is evidence
// of absence. Transport failures, timeouts, rate limits and unparseable
// replies all arrive here too, and they mean nothing at all.
function isTransactionNotFound(error: unknown): boolean {
  let current: unknown = error;

  for (let depth = 0; depth < 5; depth += 1) {
    if (!(current instanceof Error)) {
      return false;
    }

    if (current.name === "TransactionNotFoundError") {
      return true;
    }

    current = (current as { cause?: unknown }).cause;
  }

  return false;
}

// The stored bytes must be the ones this record names, or resending them would
// broadcast a transaction that no review, PIN authorization or signing check
// ever saw.
function signedBytesMatchHash(
  signedRawTx: string | null | undefined,
  hash: Hash,
): signedRawTx is Hex {
  if (typeof signedRawTx !== "string" || !/^0x[0-9a-fA-F]*$/u.test(signedRawTx)) {
    return false;
  }

  try {
    return keccak256(signedRawTx as Hex).toLowerCase() === hash.toLowerCase();
  } catch {
    return false;
  }
}

async function blockTimestamp(blockNumber: bigint): Promise<number> {
  try {
    const block = await ethereumPublicClient.getBlock({ blockNumber });

    return Number(block.timestamp) * 1000;
  } catch {
    return Date.now();
  }
}

export const trackedTransactionApi = {
  async trackNativeTransfer(
    transaction: PreparedNativeTransfer,

    hash: Hash,

    valueUsd: number | null = null,

    initialStatus: TrackedTransactionStatus = "pending",

    signedRawTx: string | null = null,
  ): Promise<TrackedTransaction> {
    const wallet = await walletEngine.getActive();

    if (!wallet) {
      throw new Error("Active wallet not found");
    }

    if (transaction.chainId !== ACTIVE_NETWORK.chain.id) {
      throw new Error("Transaction network does not match active network");
    }

    if (transaction.from.toLowerCase() !== wallet.address.toLowerCase()) {
      throw new Error("Transaction does not belong to active wallet");
    }

    const tracked: TrackedTransaction = {
      version: 1,

      hash,

      chainId: transaction.chainId,

      walletId: wallet.id,

      from: transaction.from,

      to: transaction.to,

      assetType: "native",

      symbol: ACTIVE_NETWORK.nativeSymbol,

      valueWei: transaction.value.toString(),

      valueUsd,

      nonce: typeof transaction.nonce === "number" ? transaction.nonce : null,

      signedRawTx,

      gasLimit: transaction.gas.toString(),

      broadcastAt: null,

      createdAt: Date.now(),

      status: initialStatus,

      blockNumber: null,

      gasUsed: null,

      effectiveGasPriceWei: null,

      confirmedAt: null,
    };

    await saveTrackedTransaction(tracked);

    return tracked;
  },

  async trackErc20Transfer(
    transaction: PreparedErc20Transfer,

    hash: Hash,

    valueUsd: number | null = null,

    initialStatus: TrackedTransactionStatus = "pending",

    signedRawTx: string | null = null,
  ): Promise<TrackedTransaction> {
    const wallet = await walletEngine.getActive();

    if (!wallet) {
      throw new Error("Active wallet not found");
    }

    if (transaction.chainId !== ACTIVE_NETWORK.chain.id) {
      throw new Error("Transaction network does not match active network");
    }

    if (transaction.from.toLowerCase() !== wallet.address.toLowerCase()) {
      throw new Error("Transaction does not belong to active wallet");
    }

    const tracked: TrackedTransaction = {
      version: 1,

      hash,

      chainId: transaction.chainId,

      walletId: wallet.id,

      from: transaction.from,

      to: transaction.recipient,

      assetType: "erc20",

      symbol: transaction.tokenSymbol,

      valueWei: transaction.amount.toString(),

      tokenDecimals: transaction.tokenDecimals,

      valueUsd,

      contractAddress: transaction.token,

      nonce: typeof transaction.nonce === "number" ? transaction.nonce : null,

      signedRawTx,

      gasLimit: transaction.gas.toString(),

      broadcastAt: null,

      createdAt: Date.now(),

      status: initialStatus,

      blockNumber: null,

      gasUsed: null,

      effectiveGasPriceWei: null,

      confirmedAt: null,
    };

    await saveTrackedTransaction(tracked);

    return tracked;
  },

  async trackSwap(
    transaction: PreparedSwap,

    hash: Hash,

    initialStatus: TrackedTransactionStatus = "pending",

    signedRawTx: string | null = null,

    quotedAt: number | null = null,
  ): Promise<TrackedTransaction> {
    const wallet = await walletEngine.getActive();

    if (!wallet) {
      throw new Error("Active wallet not found");
    }

    if (transaction.chainId !== ACTIVE_NETWORK.chain.id) {
      throw new Error("Transaction network does not match active network");
    }

    if (transaction.from.toLowerCase() !== wallet.address.toLowerCase()) {
      throw new Error("Transaction does not belong to active wallet");
    }

    const tracked: TrackedTransaction = {
      version: 1,

      hash,

      chainId: transaction.chainId,

      walletId: wallet.id,

      from: transaction.from,

      to: transaction.to,

      assetType: "swap",

      symbol: transaction.assetIn.symbol,

      valueWei: transaction.amountIn.toString(),

      tokenDecimals: transaction.assetIn.decimals,

      contractAddress: transaction.assetIn.address,

      symbolOut: transaction.assetOut.symbol,

      contractAddressOut: transaction.assetOut.address,

      valueOutWei: transaction.quotedAmountOut.toString(),

      minAmountOutWei: transaction.minAmountOut.toString(),

      routeLabel: describeSwapRoute(transaction),

      quotedAt,

      tokenOutDecimals: transaction.assetOut.decimals,

      actualAmountOutWei: null,

      nonce: typeof transaction.nonce === "number" ? transaction.nonce : null,

      signedRawTx,

      gasLimit: transaction.gas.toString(),

      broadcastAt: null,

      createdAt: Date.now(),

      status: initialStatus,

      blockNumber: null,

      gasUsed: null,

      effectiveGasPriceWei: null,

      confirmedAt: null,
    };

    await saveTrackedTransaction(tracked);

    return tracked;
  },

  async trackErc20Approve(
    transaction: PreparedErc20Approve,

    hash: Hash,

    initialStatus: TrackedTransactionStatus = "pending",

    signedRawTx: string | null = null,
  ): Promise<TrackedTransaction> {
    const wallet = await walletEngine.getActive();

    if (!wallet) {
      throw new Error("Active wallet not found");
    }

    if (transaction.chainId !== ACTIVE_NETWORK.chain.id) {
      throw new Error("Transaction network does not match active network");
    }

    if (transaction.from.toLowerCase() !== wallet.address.toLowerCase()) {
      throw new Error("Transaction does not belong to active wallet");
    }

    const tracked: TrackedTransaction = {
      version: 1,

      hash,

      chainId: transaction.chainId,

      walletId: wallet.id,

      from: transaction.from,

      to: transaction.token,

      assetType: "approve",

      symbol: transaction.tokenSymbol,

      valueWei: transaction.amount.toString(),

      tokenDecimals: transaction.tokenDecimals,

      contractAddress: transaction.token,

      nonce: typeof transaction.nonce === "number" ? transaction.nonce : null,

      signedRawTx,

      gasLimit: transaction.gas.toString(),

      broadcastAt: null,

      createdAt: Date.now(),

      status: initialStatus,

      blockNumber: null,

      gasUsed: null,

      effectiveGasPriceWei: null,

      confirmedAt: null,
    };

    await saveTrackedTransaction(tracked);

    return tracked;
  },

  async markBroadcastResult(hash: Hash, status: TrackedTransactionStatus) {
    await updateTrackedTransaction(
      hash,
      status === "pending"
        ? { status, broadcastAt: Date.now() }
        : { status },
    );
  },

  async resolveUnfinished(transaction: TrackedTransaction) {
    let presence: TransactionPresence;

    try {
      await ethereumPublicClient.getTransaction({ hash: transaction.hash });

      presence = "seen";
    } catch (error) {
      presence = isTransactionNotFound(error) ? "not-found" : "unknown";
    }

    let accountNonce: number | null = null;

    if (presence === "not-found") {
      try {
        accountNonce = await ethereumPublicClient.getTransactionCount({
          address: transaction.from,

          blockTag: "latest",
        });
      } catch {
        accountNonce = null;
      }
    }

    const resolution = resolveBroadcast({
      receipt: null,

      presence,

      accountNonce,

      txNonce: typeof transaction.nonce === "number" ? transaction.nonce : null,

      hasSignedTransaction:
        typeof transaction.signedRawTx === "string" &&
        transaction.signedRawTx.startsWith("0x"),
    });

    switch (resolution.action) {
      case "mark-pending":
        if (transaction.status !== "pending") {
          await updateTrackedTransaction(transaction.hash, {
            status: "pending",
          });
        }

        return resolution;

      case "supersede":
        // Another transaction consumed the nonce. That is not an on-chain
        // execution failure, and must not be told as one.
        await updateTrackedTransaction(transaction.hash, {
          status: "superseded",
        });

        return resolution;

      case "rebroadcast": {
        if (!signedBytesMatchHash(transaction.signedRawTx, transaction.hash)) {
          console.error(
            `Refusing to resend ${transaction.hash}: the stored signed bytes do not hash to this record.`,
          );

          if (transaction.status === "broadcast-pending") {
            await updateTrackedTransaction(transaction.hash, {
              status: "broadcast-unknown",
            });
          }

          return resolution;
        }

        const serializedTransaction = transaction.signedRawTx as Hex;

        try {
          const returnedHash = await ethereumPublicClient.sendRawTransaction({
            serializedTransaction,
          });

          if (returnedHash.toLowerCase() !== transaction.hash.toLowerCase()) {
            throw new Error("RPC returned unexpected transaction hash");
          }

          await updateTrackedTransaction(transaction.hash, {
            status: "pending",
          });
        } catch (error) {
          console.error(
            `Could not resend transaction ${transaction.hash}:`,
            error,
          );

          if (transaction.status === "broadcast-pending") {
            await updateTrackedTransaction(transaction.hash, {
              status: "broadcast-unknown",
            });
          }
        }

        return resolution;
      }

      case "wait":
      case "confirm":
        if (transaction.status === "broadcast-pending") {
          await updateTrackedTransaction(transaction.hash, {
            status: "broadcast-unknown",
          });
        }

        return resolution;
    }
  },

  async listRelatedToActiveWallet() {
    const wallet = await walletEngine.getActive();

    if (!wallet) {
      return [];
    }

    const all = await listTrackedTransactions();

    const address = wallet.address.toLowerCase();

    return all
      .filter(
        (transaction) =>
          transaction.chainId === ACTIVE_NETWORK.chain.id &&
          (transaction.from.toLowerCase() === address ||
            transaction.to.toLowerCase() === address),
      )
      .sort((a, b) => b.createdAt - a.createdAt);
  },

  async listAllForDevice() {
    const all = await listTrackedTransactions();

    return all
      .filter((transaction) => transaction.chainId === ACTIVE_NETWORK.chain.id)
      .sort((a, b) => b.createdAt - a.createdAt);
  },

  async listForActiveWallet() {
    const wallet = await walletEngine.getActive();

    if (!wallet) {
      return [];
    }

    const all = await listTrackedTransactions();

    return all
      .filter(
        (transaction) =>
          transaction.walletId === wallet.id &&
          transaction.chainId === ACTIVE_NETWORK.chain.id,
      )
      .sort((a, b) => b.createdAt - a.createdAt);
  },

  async backfillValueUsd(hash: Hash, symbol: string, amount: string) {
    try {
      const priced = await priceTag(symbol, amount);

      if (priced === null) {
        return;
      }

      await updateTrackedTransaction(hash, { valueUsd: priced });
    } catch {
      void 0;
    }
  },

  async refreshPending() {
    const transactions = await this.listRelatedToActiveWallet();

    const pending = transactions.filter((transaction) =>
      isAwaitingChain(transaction.status),
    );

    for (const transaction of pending) {
      try {
        const receipt = await ethereumPublicClient.getTransactionReceipt({
          hash: transaction.hash,
        });

        const status = receipt.status === "success" ? "confirmed" : "reverted";

        const credited =
          status === "confirmed" && transaction.contractAddressOut
            ? creditedFromLogs({
                logs: receipt.logs,

                owner: transaction.from,

                token: transaction.contractAddressOut,
              })
            : null;

        await updateTrackedTransaction(transaction.hash, {
          status,

          blockNumber: receipt.blockNumber.toString(),

          gasUsed: receipt.gasUsed.toString(),

          effectiveGasPriceWei: receipt.effectiveGasPrice.toString(),

          actualAmountOutWei: credited === null ? null : credited.toString(),

          signedRawTx: null,

          confirmedAt: await blockTimestamp(receipt.blockNumber),
        });
      } catch {
        await this.resolveUnfinished(transaction);
      }
    }

    return this.listRelatedToActiveWallet();
  },
};
