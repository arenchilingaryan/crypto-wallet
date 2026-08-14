import type { Hash } from "viem";

import { ACTIVE_NETWORK } from "@/constants/networks";

import type { PreparedErc20Approve } from "@/core/transactions/erc20Approve";
import type { PreparedErc20Transfer } from "@/core/transactions/erc20Transfer";
import type { PreparedNativeTransfer } from "@/core/transactions/nativeTransfer";
import type { PreparedSwap } from "@/core/transactions/swap";

import type { TrackedTransaction } from "@/core/transactions/trackedTransaction";
import { creditedFromLogs } from "@/core/transactions/executionFacts";

import { walletEngine } from "./compositionRoot";

import { ethereumPublicClient } from "./ethereumPublicClient";

import { priceTag } from "./priceLookup";

import {
  listTrackedTransactions,
  saveTrackedTransaction,
  updateTrackedTransaction,
} from "./trackedTransactionStore";

export const trackedTransactionApi = {
  async trackNativeTransfer(
    transaction: PreparedNativeTransfer,

    hash: Hash,

    valueUsd: number | null = null,
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

      createdAt: Date.now(),

      status: "pending",

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

      createdAt: Date.now(),

      status: "pending",

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

      tokenOutDecimals: transaction.assetOut.decimals,

      actualAmountOutWei: null,

      createdAt: Date.now(),

      status: "pending",

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

      createdAt: Date.now(),

      status: "pending",

      blockNumber: null,

      gasUsed: null,

      effectiveGasPriceWei: null,

      confirmedAt: null,
    };

    await saveTrackedTransaction(tracked);

    return tracked;
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

    const pending = transactions.filter(
      (transaction) => transaction.status === "pending",
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

          confirmedAt: Date.now(),
        });
      } catch {
        void 0;
      }
    }

    return this.listRelatedToActiveWallet();
  },
};
