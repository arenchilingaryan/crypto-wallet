import { mnemonicToAccount } from "viem/accounts";

import { isSessionLocked } from "@/core/security/sessionLock";

import type { SecretStorage } from "./ports/secretStorage";
import { getWalletSecretKey } from "./wallet.constants";

export async function getWalletAccount(
  walletId: string,
  storage: SecretStorage,
) {
  if (isSessionLocked()) {
    throw new Error("Wallet is locked");
  }

  const mnemonic = await storage.get(getWalletSecretKey(walletId));

  if (!mnemonic) {
    throw new Error("Wallet secret not found");
  }

  return mnemonicToAccount(mnemonic);
}
