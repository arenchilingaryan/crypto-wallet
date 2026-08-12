import type { Hash } from "viem";

import { ACTIVE_NETWORK } from "@/constants/networks";

import type { PreparedErc20Approve } from "@/core/transactions/erc20Approve";
import type { PreparedErc20Transfer } from "@/core/transactions/erc20Transfer";
import type { PreparedNativeTransfer } from "@/core/transactions/nativeTransfer";
import type { PreparedSwap } from "@/core/transactions/swap";

import type { TrackedTransaction } from "@/core/transactions/trackedTransaction";

import { getActiveWallet } from "@/core/wallet/walletStore";

import { ethereumPublicClient } from "./ethereumPublicClient";

import { expoSecretStorage } from "./expoSecretStorage";

import {
  listTrackedTransactions,
  saveTrackedTransaction,
  updateTrackedTransaction,
} from "./trackedTransactionStore";

export const trackedTransactionApi = {
  async trackNativeTransfer(
    transaction: PreparedNativeTransfer,

    hash: Hash,
  ): Promise<TrackedTransaction> {
    const wallet = await getActiveWallet(expoSecretStorage);

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
  ): Promise<TrackedTransaction> {
    const wallet = await getActiveWallet(expoSecretStorage);

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

      // Человеческий получатель — им активность и живёт.
      to: transaction.recipient,

      assetType: "erc20",

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

  async trackSwap(
    transaction: PreparedSwap,

    hash: Hash,
  ): Promise<TrackedTransaction> {
    const wallet = await getActiveWallet(expoSecretStorage);

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

      // Контрагент свопа — роутер.
      to: transaction.to,

      assetType: "swap",

      symbol: transaction.assetIn.symbol,

      valueWei: transaction.amountIn.toString(),

      tokenDecimals: transaction.assetIn.decimals,

      contractAddress: transaction.assetIn.address,

      symbolOut: transaction.assetOut.symbol,

      // Котировка на момент отправки; фактический выход может отличаться
      // в пределах слиппеджа.
      valueOutWei: transaction.quotedAmountOut.toString(),

      tokenOutDecimals: transaction.assetOut.decimals,

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
    const wallet = await getActiveWallet(expoSecretStorage);

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
    const wallet = await getActiveWallet(expoSecretStorage);

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

  async listForActiveWallet() {
    const wallet = await getActiveWallet(expoSecretStorage);

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

        await updateTrackedTransaction(transaction.hash, {
          status,

          blockNumber: receipt.blockNumber.toString(),

          gasUsed: receipt.gasUsed.toString(),

          effectiveGasPriceWei: receipt.effectiveGasPrice.toString(),

          confirmedAt: Date.now(),
        });
      } catch {
        /*
         * Receipt
         */
      }
    }

    // Отдаём related, а не только созданные этим кошельком: локальная
    // запись перевода между своими кошельками должна быть видна и получателю.
    return this.listRelatedToActiveWallet();
  },
};
