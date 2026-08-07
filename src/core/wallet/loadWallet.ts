import { mnemonicToAccount } from "viem/accounts";

import type { SecretStorage } from "./ports/secretStorage";
import { WALLET_STORAGE_KEYS } from "./wallet.constants";

export async function loadWallet(storage: SecretStorage) {
  const mnemonic = await storage.get(WALLET_STORAGE_KEYS.mnemonic);

  if (!mnemonic) {
    return null;
  }

  const account = mnemonicToAccount(mnemonic);

  return {
    address: account.address,
  };
}
