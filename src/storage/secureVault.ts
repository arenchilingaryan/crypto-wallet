import * as SecureStore from "expo-secure-store";

const STORAGE_KEYS = {
  mnemonic: "wallet.mnemonic.v1",
} as const;

export async function saveMnemonic(mnemonic: string): Promise<void> {
  await SecureStore.setItemAsync(STORAGE_KEYS.mnemonic, mnemonic);
}

export async function getMnemonic(): Promise<string | null> {
  return SecureStore.getItemAsync(STORAGE_KEYS.mnemonic);
}

export async function hasMnemonic(): Promise<boolean> {
  const mnemonic = await getMnemonic();

  return mnemonic !== null;
}

export async function clearMnemonic(): Promise<void> {
  await SecureStore.deleteItemAsync(STORAGE_KEYS.mnemonic);
}
