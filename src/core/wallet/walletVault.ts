import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";

export type WalletVault = {
  version: 2;

  wrapNonce: string;

  wrapped: string;

  nonce: string;

  ciphertext: string;
};

export class VaultOpenError extends Error {
  constructor(message: string) {
    super(message);

    this.name = "VaultOpenError";
  }
}

function isHex(value: string, bytes?: number) {
  return bytes === undefined
    ? /^[0-9a-f]+$/.test(value) && value.length % 2 === 0
    : new RegExp(`^[0-9a-f]{${bytes * 2}}$`).test(value);
}

function vaultHeader(
  vault: Pick<WalletVault, "version" | "wrapNonce" | "nonce">,
  walletId: string,
) {
  return utf8ToBytes(
    `crypto-wallet/vault/v${vault.version}|${vault.wrapNonce}|${vault.nonce}|${walletId.toLowerCase()}`,
  );
}

export function sealWalletVault({
  mnemonic,
  walletId,
  masterKey,
  wrapNonce,
  nonce,
  dek,
}: {
  mnemonic: string;
  walletId: string;
  masterKey: Uint8Array;
  wrapNonce: Uint8Array;
  nonce: Uint8Array;
  dek: Uint8Array;
}): WalletVault {
  if (masterKey.length !== 32 || dek.length !== 32) {
    throw new Error("Vault keys must be 32 bytes");
  }

  if (wrapNonce.length !== 24 || nonce.length !== 24) {
    throw new Error("Vault nonces must be 24 bytes");
  }

  const draft = {
    version: 2 as const,

    wrapNonce: bytesToHex(wrapNonce),

    nonce: bytesToHex(nonce),
  };

  const header = vaultHeader(draft, walletId);

  return {
    ...draft,

    wrapped: bytesToHex(
      xchacha20poly1305(masterKey, wrapNonce, header).encrypt(dek),
    ),

    ciphertext: bytesToHex(
      xchacha20poly1305(dek, nonce, header).encrypt(utf8ToBytes(mnemonic)),
    ),
  };
}

export function openWalletVault({
  vault,
  walletId,
  masterKey,
}: {
  vault: WalletVault;
  walletId: string;
  masterKey: Uint8Array;
}): string {
  const header = vaultHeader(vault, walletId);

  try {
    const dek = xchacha20poly1305(
      masterKey,
      hexToBytes(vault.wrapNonce),
      header,
    ).decrypt(hexToBytes(vault.wrapped));

    const plaintext = xchacha20poly1305(
      dek,
      hexToBytes(vault.nonce),
      header,
    ).decrypt(hexToBytes(vault.ciphertext));

    return new TextDecoder().decode(plaintext);
  } catch {
    throw new VaultOpenError(
      "This wallet could not be opened with the current PIN on this device",
    );
  }
}

export function parseWalletVault(value: unknown): WalletVault | null {
  const vault = value as Partial<WalletVault> | null;

  if (
    !vault ||
    vault.version !== 2 ||
    typeof vault.wrapNonce !== "string" ||
    typeof vault.nonce !== "string" ||
    typeof vault.wrapped !== "string" ||
    typeof vault.ciphertext !== "string" ||
    !isHex(vault.wrapNonce, 24) ||
    !isHex(vault.nonce, 24) ||
    !isHex(vault.wrapped) ||
    !isHex(vault.ciphertext)
  ) {
    return null;
  }

  return {
    version: 2,
    wrapNonce: vault.wrapNonce,
    nonce: vault.nonce,
    wrapped: vault.wrapped,
    ciphertext: vault.ciphertext,
  };
}
