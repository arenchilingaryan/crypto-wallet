import type { SecretStorage } from "./ports/secretStorage";
import { WALLET_STORAGE_KEYS } from "./wallet.constants";

interface PersistWalletDependencies {
  storage: SecretStorage;
}

interface PersistWalletInput {
  mnemonic: string;
}

export async function persistWallet(
  { mnemonic }: PersistWalletInput,
  { storage }: PersistWalletDependencies,
): Promise<void> {
  const existingMnemonic = await storage.get(WALLET_STORAGE_KEYS.mnemonic);

  if (existingMnemonic) {
    throw new Error("Wallet already exists");
  }

  await storage.set(WALLET_STORAGE_KEYS.mnemonic, mnemonic);
}
