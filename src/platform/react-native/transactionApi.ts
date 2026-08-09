import type { Address ,
  keccak256,
  type Hash,
  type Hex,
} from "viem";
import { sepolia } from "viem/chains";

import type { NativeTransferIntent } from "@/core/transactions/nativeTransfer";
import { prepareNativeTransfer } from "@/core/transactions/prepareNativeTransfer";
import { getActiveWallet } from "@/core/wallet/walletStore";

import { ethereumPublicClient } from "./ethereumPublicClient";
import { expoSecretStorage } from "./expoSecretStorage";
 keccak256, type Hash, type Hex } from "viem";
t;
};

export const transactionApi = {
  async broadcastSignedTransaction(serializedTransaction: Hex): Promise<Hash> {
    const rpcChainId = await ethereumPublicClient.getChainId();

    if (rpcChainId !== sepolia.id) {
      throw new Error("RPC network does not match Sepolia");
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

      chainId: sepolia.id,

      from: activeWallet.address,

      to,

      value,
    };

    return prepareNativeTransfer(
      intent,
      {
        expectedChainId: sepolia.id,

        expectedFrom: activeWallet.address,
      },
      ethereumPublicClient,
    );
  },
};
