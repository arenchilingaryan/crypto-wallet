import { scrypt } from "@noble/hashes/scrypt.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";

export const PIN_KDF_PARAMS = {
  N: 16384,
  r: 8,
  p: 1,
  dkLen: 32,
} as const;

export type PinVerifier = {
  version: 2;

  vaultSalt?: string;

  kdf: "scrypt";

  N: number;

  r: number;

  p: number;

  salt: string;

  hash: string;
};

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

  const derived = scrypt(utf8ToBytes(pin), utf8ToBytes(salt), {
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

  return scrypt(utf8ToBytes(pin), utf8ToBytes(`vault:${vaultSalt}`), {
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
    const parsed = JSON.parse(raw) as Partial<PinVerifier>;

    if (
      parsed?.version !== 2 ||
      parsed.kdf !== "scrypt" ||
      typeof parsed.salt !== "string" ||
      typeof parsed.hash !== "string" ||
      typeof parsed.N !== "number" ||
      typeof parsed.r !== "number" ||
      typeof parsed.p !== "number" ||
      !areKdfParamsSane({ N: parsed.N, r: parsed.r, p: parsed.p })
    ) {
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
