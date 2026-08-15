import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";

import { scryptKdf } from "./scryptKdf";

export const PIN_KDF_PARAMS = {
  N: 16384,
  r: 8,
  p: 1,
  dkLen: 32,
} as const;

// v2 runs the password KDF twice per unlock: once against its own salt to check
// the PIN, once against the vault salt to open the vault. An offline attacker
// only ever needs one of those to test a candidate PIN, so the second is a cost
// the owner pays alone. v3 keeps the vault derivation exactly as it is and
// derives the check from that same output through HKDF — cheap, and separated
// by its own info string so the verifier can never be mistaken for key material.
export type PinVerifierV2 = {
  version: 2;

  vaultSalt?: string;

  kdf: "scrypt";

  N: number;

  r: number;

  p: number;

  salt: string;

  hash: string;
};

export type PinVerifierV3 = {
  version: 3;

  vaultSalt: string;

  kdf: "scrypt";

  N: number;

  r: number;

  p: number;

  hash: string;
};

export type PinVerifier = PinVerifierV2 | PinVerifierV3;

// Domain separation: this label is what stops the stored check value from being
// usable as, or confusable with, the key that actually opens the vault.
export const PIN_VERIFIER_V3_INFO = "wallet-pin-verifier-v3";

export function deriveVerifierHashFromVaultKey(
  vaultPinKey: Uint8Array,
): string {
  return bytesToHex(
    hkdf(sha256, vaultPinKey, undefined, utf8ToBytes(PIN_VERIFIER_V3_INFO), 32),
  );
}

export function createPinVerifierV3(
  vaultSalt: string,
  vaultPinKey: Uint8Array,
): PinVerifierV3 {
  return {
    version: 3,

    vaultSalt,

    kdf: "scrypt",

    N: PIN_KDF_PARAMS.N,

    r: PIN_KDF_PARAMS.r,

    p: PIN_KDF_PARAMS.p,

    hash: deriveVerifierHashFromVaultKey(vaultPinKey),
  };
}

export type PinKdfParams = {
  N: number;
  r: number;
  p: number;
};

export function areKdfParamsSane({ N, r, p }: PinKdfParams) {
  return (
    Number.isInteger(N) &&
    N >= 4096 &&
    N <= 131072 &&
    (N & (N - 1)) === 0 &&
    Number.isInteger(r) &&
    r >= 1 &&
    r <= 16 &&
    Number.isInteger(p) &&
    p >= 1 &&
    p <= 4
  );
}

export function derivePinHash(
  pin: string,
  salt: string,
  params: PinKdfParams = PIN_KDF_PARAMS,
): string {
  if (!areKdfParamsSane(params)) {
    throw new Error("Refusing to derive a PIN hash with unsupported settings");
  }

  const derived = scryptKdf(utf8ToBytes(pin), utf8ToBytes(salt), {
    N: params.N,
    r: params.r,
    p: params.p,
    dkLen: PIN_KDF_PARAMS.dkLen,
  });

  return bytesToHex(derived);
}

export function deriveVaultPinKey(pin: string, vaultSalt: string): Uint8Array {
  if (!areKdfParamsSane(PIN_KDF_PARAMS)) {
    throw new Error("Refusing to derive a vault key with unsupported settings");
  }

  return scryptKdf(utf8ToBytes(pin), utf8ToBytes(`vault:${vaultSalt}`), {
    N: PIN_KDF_PARAMS.N,
    r: PIN_KDF_PARAMS.r,
    p: PIN_KDF_PARAMS.p,
    dkLen: PIN_KDF_PARAMS.dkLen,
  });
}

export function createPinVerifier(
  pin: string,
  salt: string,
  vaultSalt: string,
): PinVerifier {
  return {
    version: 2,

    vaultSalt,

    kdf: "scrypt",

    N: PIN_KDF_PARAMS.N,

    r: PIN_KDF_PARAMS.r,

    p: PIN_KDF_PARAMS.p,

    salt,

    hash: derivePinHash(pin, salt),
  };
}

export function serializePinVerifier(verifier: PinVerifier): string {
  return JSON.stringify(verifier);
}

export function parsePinVerifier(raw: string | null): PinVerifier | null {
  if (!raw) {
    return null;
  }

  try {
    // Deliberately a loose shape: this is untrusted JSON from disk, and the
    // checks below are what turn it into one of the known versions.
    const parsed = JSON.parse(raw) as {
      version?: unknown;
      kdf?: unknown;
      N?: unknown;
      r?: unknown;
      p?: unknown;
      salt?: unknown;
      vaultSalt?: unknown;
      hash?: unknown;
    };

    if (
      parsed?.kdf !== "scrypt" ||
      typeof parsed.hash !== "string" ||
      typeof parsed.N !== "number" ||
      typeof parsed.r !== "number" ||
      typeof parsed.p !== "number" ||
      !areKdfParamsSane({ N: parsed.N, r: parsed.r, p: parsed.p })
    ) {
      return null;
    }

    // A version we do not know may have been written by a newer build; refusing
    // it keeps the vault intact instead of overwriting something we cannot read.
    if (parsed.version === 3) {
      if (typeof parsed.vaultSalt !== "string" || parsed.vaultSalt === "") {
        return null;
      }

      return {
        version: 3,
        vaultSalt: parsed.vaultSalt,
        kdf: "scrypt",
        N: parsed.N,
        r: parsed.r,
        p: parsed.p,
        hash: parsed.hash,
      };
    }

    if (parsed.version !== 2 || typeof parsed.salt !== "string") {
      return null;
    }

    return {
      version: 2,
      vaultSalt:
        typeof parsed.vaultSalt === "string" ? parsed.vaultSalt : undefined,
      kdf: "scrypt",
      N: parsed.N,
      r: parsed.r,
      p: parsed.p,
      salt: parsed.salt,
      hash: parsed.hash,
    };
  } catch {
    return null;
  }
}

export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) {
    return false;
  }

  let difference = 0;

  for (let index = 0; index < a.length; index++) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }

  return difference === 0;
}
