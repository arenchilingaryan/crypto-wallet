import { mnemonicToAccount } from "viem/accounts";

import { assertSessionUnlocked } from "@/core/security/sessionLock";
import type { SecretStorage } from "@/core/wallet/ports/secretStorage";
import { getWalletSecretKey } from "@/core/wallet/wallet.constants";
import { getActiveWallet } from "@/core/wallet/walletStore";

export async function getActiveSigningAccount(storage: SecretStorage) {
  // Проверяем ДО чтения mnemonic.
  assertSessionUnlocked();

  const wallet = await getActiveWallet(storage);

  if (!wallet) {
    throw new Error("Active wallet not found");
  }

  const mnemonic = await storage.get(getWalletSecretKey(wallet.id));

  if (!mnemonic) {
    throw new Error("Wallet secret not found");
  }

  const account = mnemonicToAccount(mnemonic);

  // Integrity check:
  // secret обязан соответствовать registry.
  if (account.address.toLowerCase() !== wallet.address.toLowerCase()) {
    throw new Error("Wallet secret does not match wallet address");
  }

  return account;
}
