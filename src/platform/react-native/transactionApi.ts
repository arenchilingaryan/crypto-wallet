import { ACTIVE_NETWORK } from "@/constants/networks";
import { keccak256, type Address, type Hash, type Hex } from "viem";

import { erc20Abi } from "@/core/blockchain/erc20Abi";
import {
  encodeErc20Transfer,
  type Erc20TransferIntent,
} from "@/core/transactions/erc20Transfer";
import type { NativeTransferIntent } from "@/core/transactions/nativeTransfer";
import { prepareErc20Transfer } from "@/core/transactions/prepareErc20Transfer";
import { prepareNativeTransfer } from "@/core/transactions/prepareNativeTransfer";
import { getActiveWallet } from "@/core/wallet/walletStore";

import { ethereumPublicClient } from "./ethereumPublicClient";
import { expoSecretStorage } from "./expoSecretStorage";

type PrepareNativeTransferInput = {
  to: Address;
  value: bigint;
};

type Erc20TransferInput = {
  token: Address;

  to: Address;

  amount: bigint;

  tokenSymbol: string;

  tokenDecimals: number;
};

export type Erc20TransferQuote = {
  ethBalanceWei: bigint;

  tokenBalance: bigint;

  gas: bigint;

  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;

  maximumNetworkFeeWei: bigint;

  hasSufficientTokenBalance: boolean;
  hasSufficientEthForFee: boolean;
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

  // Баланс токена активного кошелька — экран send/erc20 собирает
  // состояние сам: метаданные из getTokenMetadata, баланс отсюда.
  async getErc20Balance(token: Address): Promise<bigint> {
    const activeWallet = await getActiveWallet(expoSecretStorage);

    if (!activeWallet) {
      throw new Error("Active wallet not found");
    }

    return ethereumPublicClient.readContract({
      address: token,

      abi: erc20Abi,

      functionName: "balanceOf",

      args: [activeWallet.address],
    });
  },

  async quoteErc20Transfer({
    token,
    to,
    amount,
  }: Pick<Erc20TransferInput, "token" | "to" | "amount">): Promise<Erc20TransferQuote> {
    const activeWallet = await getActiveWallet(expoSecretStorage);

    if (!activeWallet) {
      throw new Error("Active wallet not found");
    }

    const rpcChainId = await ethereumPublicClient.getChainId();

    if (rpcChainId !== ACTIVE_NETWORK.chain.id) {
      throw new Error(`RPC network does not match ${ACTIVE_NETWORK.name}`);
    }

    const [ethBalanceWei, tokenBalance, fees] = await Promise.all([
      ethereumPublicClient.getBalance({
        address: activeWallet.address,

        blockTag: "pending",
      }),

      ethereumPublicClient.readContract({
        address: token,

        abi: erc20Abi,

        functionName: "balanceOf",

        args: [activeWallet.address],
      }),

      ethereumPublicClient.estimateFeesPerGas(),
    ]);

    // transfer с суммой выше баланса ревертится ещё на estimateGas —
    // при нехватке токенов честно отвечаем без оценки газа.
    if (amount > tokenBalance) {
      return {
        ethBalanceWei,

        tokenBalance,

        gas: 0n,

        maxFeePerGas: fees.maxFeePerGas,

        maxPriorityFeePerGas: fees.maxPriorityFeePerGas,

        maximumNetworkFeeWei: 0n,

        hasSufficientTokenBalance: false,

        hasSufficientEthForFee: ethBalanceWei > 0n,
      };
    }

    const gas = await ethereumPublicClient.estimateGas({
      account: activeWallet.address,

      to: token,

      value: 0n,

      data: encodeErc20Transfer(to, amount),
    });

    const maximumNetworkFeeWei = gas * fees.maxFeePerGas;

    return {
      ethBalanceWei,

      tokenBalance,

      gas,

      maxFeePerGas: fees.maxFeePerGas,

      maxPriorityFeePerGas: fees.maxPriorityFeePerGas,

      maximumNetworkFeeWei,

      hasSufficientTokenBalance: true,

      hasSufficientEthForFee: maximumNetworkFeeWei <= ethBalanceWei,
    };
  },

  async prepareErc20Transfer({
    token,
    to,
    amount,
    tokenSymbol,
    tokenDecimals,
  }: Erc20TransferInput) {
    const activeWallet = await getActiveWallet(expoSecretStorage);

    if (!activeWallet) {
      throw new Error("Active wallet not found");
    }

    const intent: Erc20TransferIntent = {
      kind: "erc20-transfer",

      chainId: ACTIVE_NETWORK.chain.id,

      from: activeWallet.address,

      token,

      recipient: to,

      amount,

      tokenSymbol,

      tokenDecimals,
    };

    return prepareErc20Transfer(
      intent,
      {
        expectedChainId: ACTIVE_NETWORK.chain.id,

        expectedFrom: activeWallet.address,
      },
      ethereumPublicClient,
    );
  },
};
