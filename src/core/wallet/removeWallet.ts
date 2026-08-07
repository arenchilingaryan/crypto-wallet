import type { SecretStorage } from "./ports/secretStorage";
import { WALLET_STORAGE_KEYS } from "./wallet.constants";

export function removeWallet(storage: SecretStorage): Promise<void> {
  return storage.remove(WALLET_STORAGE_KEYS.mnemonic);
}
