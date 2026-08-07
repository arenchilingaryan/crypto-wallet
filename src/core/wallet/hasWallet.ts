import type { SecretStorage } from "./ports/secretStorage";
import { WALLET_STORAGE_KEYS } from "./wallet.constants";

export async function hasWallet(storage: SecretStorage): Promise<boolean> {
  const mnemonic = await storage.get(WALLET_STORAGE_KEYS.mnemonic);

  return mnemonic !== null;
}
