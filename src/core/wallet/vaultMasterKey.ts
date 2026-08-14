import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";

export const VAULT_KEK_INFO = "crypto-wallet/vault-kek/v2";

export type VaultKeySlot = {
  version: 2;

  kekSalt: string;

  wrapNonce: string;

  wrapped: string;
};

export class VaultKeyError extends Error {
  constructor(message: string) {
    super(message);

    this.name = "VaultKeyError";
  }
}

function isHex(value: string, bytes: number) {
  return new RegExp(`^[0-9a-f]{${bytes * 2}}$`).test(value);
}

function slotHeader(slot: Pick<VaultKeySlot, "version" | "kekSalt" | "wrapNonce">) {
  return utf8ToBytes(
    `crypto-wallet/slot/v${slot.version}|${slot.kekSalt}|${slot.wrapNonce}`,
  );
}

function deriveKek(deviceKey: Uint8Array, pinKey: Uint8Array, kekSalt: string) {
  const ikm = new Uint8Array(deviceKey.length + pinKey.length);

  ikm.set(deviceKey, 0);

  ikm.set(pinKey, deviceKey.length);

  return hkdf(sha256, ikm, hexToBytes(kekSalt), utf8ToBytes(VAULT_KEK_INFO), 32);
}

export function wrapMasterKey({
  masterKey,
  deviceKey,
  pinKey,
  kekSalt,
  wrapNonce,
}: {
  masterKey: Uint8Array;
  deviceKey: Uint8Array;
  pinKey: Uint8Array;
  kekSalt: Uint8Array;
  wrapNonce: Uint8Array;
}): VaultKeySlot {
  if (masterKey.length !== 32 || deviceKey.length !== 32) {
    throw new VaultKeyError("Vault keys must be 32 bytes");
  }

  if (pinKey.length !== 32) {
    throw new VaultKeyError("The PIN factor must be 32 bytes");
  }

  if (wrapNonce.length !== 24) {
    throw new VaultKeyError("Vault nonces must be 24 bytes");
  }

  const slot = {
    version: 2 as const,

    kekSalt: bytesToHex(kekSalt),

    wrapNonce: bytesToHex(wrapNonce),
  };

  const kek = deriveKek(deviceKey, pinKey, slot.kekSalt);

  return {
    ...slot,

    wrapped: bytesToHex(
      xchacha20poly1305(kek, wrapNonce, slotHeader(slot)).encrypt(masterKey),
    ),
  };
}

export function unwrapMasterKey({
  slot,
  deviceKey,
  pinKey,
}: {
  slot: VaultKeySlot;
  deviceKey: Uint8Array;
  pinKey: Uint8Array;
}): Uint8Array {
  try {
    const kek = deriveKek(deviceKey, pinKey, slot.kekSalt);

    return xchacha20poly1305(
      kek,
      hexToBytes(slot.wrapNonce),
      slotHeader(slot),
    ).decrypt(hexToBytes(slot.wrapped));
  } catch {
    throw new VaultKeyError(
      "Wrong PIN for this device, or the stored key is damaged",
    );
  }
}

export function parseVaultKeySlot(raw: string | null): VaultKeySlot | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<VaultKeySlot>;

    if (
      parsed.version !== 2 ||
      typeof parsed.kekSalt !== "string" ||
      typeof parsed.wrapNonce !== "string" ||
      typeof parsed.wrapped !== "string" ||
      !isHex(parsed.kekSalt, 16) ||
      !isHex(parsed.wrapNonce, 24) ||
      !/^[0-9a-f]+$/.test(parsed.wrapped)
    ) {
      return null;
    }

    return {
      version: 2,
      kekSalt: parsed.kekSalt,
      wrapNonce: parsed.wrapNonce,
      wrapped: parsed.wrapped,
    };
  } catch {
    return null;
  }
}

export function serializeVaultKeySlot(slot: VaultKeySlot): string {
  return JSON.stringify(slot);
}
