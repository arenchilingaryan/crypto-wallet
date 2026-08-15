import type { SecretStore } from "@/core/ports/secretStore";
import {
  createWalletSecret,
  parseWalletSecret,
  type WalletSecret,
} from "@/core/wallet/walletSecret";
import {
  openWalletVault,
  parseWalletVault,
  sealWalletVault,
} from "@/core/wallet/walletVault";

import { expoRandomSource } from "./expoRandomSource";
import {
  clearPendingSecret,
  peekPendingSecret,
  stagePendingSecret,
} from "./pendingSecrets";
import { getUnlockMaterial } from "./unlockMaterial";

function getSecretKey(walletId: string) {
  return `wallet.secret.${walletId}`;
}

async function sealForStorage(
  walletId: string,
  secret: WalletSecret,
  masterKey: Uint8Array,
) {
  const [wrapNonce, nonce, dek] = await Promise.all([
    expoRandomSource.getBytes(24),
    expoRandomSource.getBytes(24),
    expoRandomSource.getBytes(32),
  ]);

  return JSON.stringify(
    sealWalletVault({
      mnemonic: secret.mnemonic,
      walletId,
      masterKey,
      wrapNonce,
      nonce,
      dek,
    }),
  );
}

export const expoSecretStore = {
  async load(walletId: string): Promise<WalletSecret | null> {
    const staged = peekPendingSecret(walletId);

    if (staged) {
      return staged;
    }

    const raw = localStorage.getItem(getSecretKey(walletId));

    if (!raw) {
      return null;
    }

    let parsed: unknown = null;

    try {
      parsed = JSON.parse(raw);
    } catch {
      return parseWalletSecret(raw);
    }

    const vault = parseWalletVault(parsed);

    if (!vault) {
      return parseWalletSecret(raw);
    }

    const masterKey = getUnlockMaterial();

    if (!masterKey) {
      throw new Error("Enter your PIN to unlock this wallet");
    }

    return createWalletSecret(
      openWalletVault({ vault, walletId, masterKey }),
    );
  },

  async save(walletId: string, secret: WalletSecret) {
    const masterKey = getUnlockMaterial();

    if (!masterKey) {
      stagePendingSecret(walletId, secret);

      return { durable: false };
    }

    localStorage.setItem(
      getSecretKey(walletId),
      await sealForStorage(walletId, secret, masterKey),
    );

    clearPendingSecret(walletId);

    return { durable: true };
  },

  async peek(walletId: string): Promise<string | null> {
    return localStorage.getItem(getSecretKey(walletId));
  },

  async discardStaged(walletId: string) {
    clearPendingSecret(walletId);
  },

  async remove(walletId: string) {
    clearPendingSecret(walletId);

    localStorage.removeItem(getSecretKey(walletId));
  },
} satisfies SecretStore & { peek(walletId: string): Promise<string | null> };
