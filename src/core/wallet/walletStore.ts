import { mnemonicToAccount } from "viem/accounts";

import type { Address } from "viem";

import type { SecretStorage } from "./ports/secretStorage";
import { getWalletSecretKey, WALLET_STORAGE_KEYS } from "./wallet.constants";

export type WalletRecord = {
  id: string;
  name: string;
  address: Address;
};

type WalletRegistry = WalletRecord[];

function createWalletId(address: Address) {
  return address.toLowerCase();
}

function getNextWalletName(wallets: WalletRegistry) {
  const maxIndex = wallets.reduce((max, wallet) => {
    const match = /^Wallet (\d+)$/.exec(wallet.name);

    if (!match) {
      return max;
    }

    return Math.max(max, Number(match[1]));
  }, 0);

  return `Wallet ${maxIndex + 1}`;
}

async function readRegistry(storage: SecretStorage): Promise<WalletRegistry> {
  const value = await storage.get(WALLET_STORAGE_KEYS.registry);

  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed as WalletRegistry;
  } catch {
    return [];
  }
}

async function writeRegistry(
  storage: SecretStorage,
  wallets: WalletRegistry,
): Promise<void> {
  await storage.set(WALLET_STORAGE_KEYS.registry, JSON.stringify(wallets));
}

export async function migrateLegacyWallet(
  storage: SecretStorage,
): Promise<void> {
  const mnemonic = await storage.get(WALLET_STORAGE_KEYS.legacyMnemonic);

  if (!mnemonic) {
    return;
  }

  const account = mnemonicToAccount(mnemonic);

  const walletId = createWalletId(account.address);

  const wallets = await readRegistry(storage);

  const existingWallet = wallets.find((wallet) => wallet.id === walletId);

  await storage.set(getWalletSecretKey(walletId), mnemonic);

  if (!existingWallet) {
    const wallet: WalletRecord = {
      id: walletId,
      name: getNextWalletName(wallets),
      address: account.address,
    };

    await writeRegistry(storage, [...wallets, wallet]);
  }

  const activeWalletId = await storage.get(WALLET_STORAGE_KEYS.activeWalletId);

  if (!activeWalletId) {
    await storage.set(WALLET_STORAGE_KEYS.activeWalletId, walletId);
  }

  await storage.remove(WALLET_STORAGE_KEYS.legacyMnemonic);
}

export async function addWallet(
  mnemonic: string,
  storage: SecretStorage,
): Promise<WalletRecord> {
  await migrateLegacyWallet(storage);

  const account = mnemonicToAccount(mnemonic);

  const walletId = createWalletId(account.address);

  const wallets = await readRegistry(storage);

  const existingWallet = wallets.find((wallet) => wallet.id === walletId);

  if (existingWallet) {
    await storage.set(WALLET_STORAGE_KEYS.activeWalletId, existingWallet.id);

    return existingWallet;
  }

  const wallet: WalletRecord = {
    id: walletId,
    name: getNextWalletName(wallets),
    address: account.address,
  };

  await storage.set(getWalletSecretKey(wallet.id), mnemonic);

  await writeRegistry(storage, [...wallets, wallet]);

  await storage.set(WALLET_STORAGE_KEYS.activeWalletId, wallet.id);

  return wallet;
}

export async function listWallets(
  storage: SecretStorage,
): Promise<WalletRecord[]> {
  await migrateLegacyWallet(storage);

  return readRegistry(storage);
}

export async function getActiveWallet(
  storage: SecretStorage,
): Promise<WalletRecord | null> {
  await migrateLegacyWallet(storage);

  const wallets = await readRegistry(storage);

  if (wallets.length === 0) {
    return null;
  }

  const activeWalletId = await storage.get(WALLET_STORAGE_KEYS.activeWalletId);

  const activeWallet = wallets.find((wallet) => wallet.id === activeWalletId);

  if (activeWallet) {
    return activeWallet;
  }

  const fallbackWallet = wallets[0];

  await storage.set(WALLET_STORAGE_KEYS.activeWalletId, fallbackWallet.id);

  return fallbackWallet;
}

export async function setActiveWallet(
  walletId: string,
  storage: SecretStorage,
): Promise<WalletRecord> {
  await migrateLegacyWallet(storage);

  const wallets = await readRegistry(storage);

  const wallet = wallets.find((item) => item.id === walletId);

  if (!wallet) {
    throw new Error("Wallet not found");
  }

  await storage.set(WALLET_STORAGE_KEYS.activeWalletId, wallet.id);

  return wallet;
}

export async function removeWallet(
  walletId: string,
  storage: SecretStorage,
): Promise<WalletRecord | null> {
  await migrateLegacyWallet(storage);

  const wallets = await readRegistry(storage);

  const wallet = wallets.find((item) => item.id === walletId);

  if (!wallet) {
    throw new Error("Wallet not found");
  }

  const remainingWallets = wallets.filter((item) => item.id !== walletId);

  const activeWalletId = await storage.get(WALLET_STORAGE_KEYS.activeWalletId);

  await writeRegistry(storage, remainingWallets);

  let nextActiveWallet: WalletRecord | null = null;

  if (
    activeWalletId === walletId ||
    !remainingWallets.some((item) => item.id === activeWalletId)
  ) {
    nextActiveWallet = remainingWallets[0] ?? null;

    if (nextActiveWallet) {
      await storage.set(
        WALLET_STORAGE_KEYS.activeWalletId,
        nextActiveWallet.id,
      );
    } else {
      await storage.remove(WALLET_STORAGE_KEYS.activeWalletId);
    }
  } else {
    nextActiveWallet =
      remainingWallets.find((item) => item.id === activeWalletId) ?? null;
  }

  await storage.remove(getWalletSecretKey(walletId));

  return nextActiveWallet;
}
