import { ACTIVE_NETWORK } from "@/constants/networks";
import { keccak256, type Address, type Hash, type Hex } from "viem";

import type { NativeTransferIntent } from "@/core/transactions/nativeTransfer";
import { prepareNativeTransfer } from "@/core/transactions/prepareNativeTransfer";
import { getActiveWallet } from "@/core/wallet/walletStore";

import { ethereumPublicClient } from "./ethereumPublicClient";
import { expoSecretStorage } from "./expoSecretStorage";

type PrepareNativeTransferInput = {
  to: Address;
  value: bigint;
};

export type NativeTransferQuote = {
  balanceWei: bigint;

  gas: bigint;

  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;

  maximumNetworkFeeWei: bigint;
  maximumTotalWei: bigint;

  hasSufficientBalance: boolean;
};

export const transactionApi = {
  async quoteNativeTransfer({
    to,
    value,
  }: PrepareNativeTransferInput): Promise<NativeTransferQuote> {
    const activeWallet = await getActiveWallet(expoSecretStorage);

    if (!activeWallet) {
      throw new Error("Active wallet not found");
    }

    const rpcChainId = await ethereumPublicClient.getChainId();

    if (rpcChainId !== ACTIVE_NETWORK.chain.id) {
      throw new Error(`RPC network does not match ${ACTIVE_NETWORK.name}`);
    }

    const [balanceWei, fees] = await Promise.all([
      ethereumPublicClient.getBalance({
        address: activeWallet.address,

        blockTag: "pending",
      }),

      ethereumPublicClient.estimateFeesPerGas(),
    ]);

    if (value >= balanceWei) {
      return {
        balanceWei,

        gas: 0n,

        maxFeePerGas: fees.maxFeePerGas,

        maxPriorityFeePerGas: fees.maxPriorityFeePerGas,

        maximumNetworkFeeWei: 0n,

        maximumTotalWei: value,

        hasSufficientBalance: false,
      };
    }

    const gas = await ethereumPublicClient.estimateGas({
      account: activeWallet.address,

      to,

      value,

      data: "0x",
    });

    const maximumNetworkFeeWei = gas * fees.maxFeePerGas;

    const maximumTotalWei = value + maximumNetworkFeeWei;

    return {
      balanceWei,

      gas,

      maxFeePerGas: fees.maxFeePerGas,

      maxPriorityFeePerGas: fees.maxPriorityFeePerGas,

      maximumNetworkFeeWei,

      maximumTotalWei,

      hasSufficientBalance: maximumTotalWei <= balanceWei,
    };
  },
  async broadcastSignedTransaction(serializedTransaction: Hex): Promise<Hash> {
    const rpcChainId = await ethereumPublicClient.getChainId();

    if (rpcChainId !== ACTIVE_NETWORK.chain.id) {
      throw new Error(`RPC network does not match ${ACTIVE_NETWORK.name}`);
    }

    const expectedHash = keccak256(serializedTransaction);

    const hash = await ethereumPublicClient.sendRawTransaction({
      serializedTransaction,
    });

    if (hash.toLowerCase() !== expectedHash.toLowerCase()) {
      throw new Error("RPC returned unexpected transaction hash");
    }

    return hash;
  },

  async waitForTransactionReceipt(hash: Hash) {
    return ethereumPublicClient.waitForTransactionReceipt({
      hash,
      confirmations: 1,
      timeout: 60_000,
    });
  },

  async prepareNativeTransfer({ to, value }: PrepareNativeTransferInput) {
    const activeWallet = await getActiveWallet(expoSecretStorage);

    if (!activeWallet) {
      throw new Error("Active wallet not found");
    }

    const intent: NativeTransferIntent = {
      kind: "native-transfer",

      chainId: ACTIVE_NETWORK.chain.id,

      from: activeWallet.address,

      to,

      value,
    };

    return prepareNativeTransfer(
      intent,
      {
        expectedChainId: ACTIVE_NETWORK.chain.id,

        expectedFrom: activeWallet.address,
      },
      ethereumPublicClient,
    );
  },
};
