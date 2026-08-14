import { mnemonicToAccount } from "viem/accounts";

import type { SecretStore } from "@/core/ports/secretStore";
import type {
  SignableTransaction,
  WalletSigner,
} from "@/core/ports/walletSigner";

import { assertSessionUnlocked } from "@/core/security/sessionLock";
import type { WalletEngine } from "@/core/wallet/walletEngine";

type LocalSignerDependencies = {
  engine: WalletEngine;

  secrets: SecretStore;

  assertNotFrozen?: () => Promise<void>;
};

export function createLocalMnemonicSigner({
  engine,
  secrets,
  assertNotFrozen,
}: LocalSignerDependencies): WalletSigner {
  async function loadAccount() {
    assertSessionUnlocked();

    if (assertNotFrozen) {
      await assertNotFrozen();
    }

    const wallet = await engine.getActive();

    if (!wallet) {
      throw new Error("Active wallet not found");
    }

    const secret = await secrets.load(wallet.id);

    if (!secret) {
      throw new Error("Wallet secret not found");
    }

    const account = mnemonicToAccount(secret.mnemonic);

    if (account.address.toLowerCase() !== wallet.address.toLowerCase()) {
      throw new Error("Wallet secret does not match wallet address");
    }

    return account;
  }

  return {
    async getAddress() {
      const account = await loadAccount();

      return account.address;
    },

    async signMessage(message: string) {
      const account = await loadAccount();

      return account.signMessage({
        message,
      });
    },

    async signTransaction(transaction: SignableTransaction) {
      const account = await loadAccount();

      if (account.address.toLowerCase() !== transaction.from.toLowerCase()) {
        throw new Error(
          "Active wallet changed: refusing to sign for another address",
        );
      }

      return account.signTransaction({
        type: transaction.type,

        chainId: transaction.chainId,

        to: transaction.to,

        value: transaction.value,

        nonce: transaction.nonce,

        gas: transaction.gas,

        maxFeePerGas: transaction.maxFeePerGas,

        maxPriorityFeePerGas: transaction.maxPriorityFeePerGas,

        data: transaction.data,
      });
    },
  };
}
