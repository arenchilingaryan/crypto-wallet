import { scrypt } from "@noble/hashes/scrypt.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";

// The PIN KDF is the single most expensive thing this wallet does, and on a
// phone the pure-JS implementation takes seconds. Swapping in a native one is
// purely an implementation change: same algorithm, same parameters, same salts,
// same output bytes. Nothing about the stored format may move.
//
// Because "same bytes" is the entire safety of that swap, it is not assumed —
// it is checked. A candidate implementation must reproduce fixed vectors before
// it is allowed to derive anything; if it cannot, the JS implementation stays.
// A wrong implementation would not corrupt the vault (the key simply would not
// open it), but it would lock the owner out of their own wallet, which is the
// same thing from where they are standing.

export type ScryptParams = {
  N: number;

  r: number;

  p: number;

  dkLen: number;
};

export type ScryptImplementation = (
  password: Uint8Array,
  salt: Uint8Array,
  params: ScryptParams,
) => Uint8Array;

export const jsScrypt: ScryptImplementation = (password, salt, params) =>
  scrypt(password, salt, {
    N: params.N,
    r: params.r,
    p: params.p,
    dkLen: params.dkLen,
  });

// Fixed vectors at the parameters this wallet actually uses, produced by the
// implementation that wrote every vault in the field. They are the contract:
// anything that derives PIN material must reproduce them exactly. Checking them
// costs one derivation on the candidate implementation — fast, by definition,
// for the fast implementation we are trying to adopt.
export const SCRYPT_PARITY_VECTORS: readonly {
  pin: string;
  salt: string;
  params: ScryptParams;
  expectedHex: string;
}[] = [
  {
    pin: "123456",
    salt: "a1b2c3d4e5f60718293a4b5c6d7e8f90",
    params: { N: 16384, r: 8, p: 1, dkLen: 32 },
    expectedHex:
      "bf6bdd1693dc31289e14d0eca9d8dd21d9e5d6945a99a798b2bbd904873d4578",
  },
  {
    // The vault derivation prefixes its salt; cover that shape too.
    pin: "000000",
    salt: "vault:a1b2c3d4e5f60718293a4b5c6d7e8f90",
    params: { N: 16384, r: 8, p: 1, dkLen: 32 },
    expectedHex:
      "6995695a2db721ddf0cea076312f71edffb7eb495b55651395e8f09112130250",
  },
  {
    pin: "948273",
    salt: "0f1e2d3c4b5a69788796a5b4c3d2e1f0",
    params: { N: 16384, r: 8, p: 1, dkLen: 32 },
    expectedHex:
      "3faa079570e87b2e9ddd7d7eb4af7986b963316f665192e8b0765608052c4eba",
  },
];

export type ParityResult =
  | { ok: true }
  | { ok: false; reason: string };

export function checkScryptParity(
  implementation: ScryptImplementation,
): ParityResult {
  for (const vector of SCRYPT_PARITY_VECTORS) {
    let produced: string;

    try {
      produced = bytesToHex(
        implementation(
          utf8ToBytes(vector.pin),
          utf8ToBytes(vector.salt),
          vector.params,
        ),
      );
    } catch (error) {
      return {
        ok: false,
        reason: `threw while deriving a known vector: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      };
    }

    if (produced !== vector.expectedHex) {
      return {
        ok: false,
        reason: "produced different bytes for a known vector",
      };
    }
  }

  return { ok: true };
}

let active: ScryptImplementation = jsScrypt;

let activeName = "js";

// Returns whether the implementation was adopted. A rejected one changes
// nothing: the wallet keeps deriving exactly as it did before.
export function adoptScryptImplementation(
  name: string,
  implementation: ScryptImplementation,
): ParityResult {
  const parity = checkScryptParity(implementation);

  if (!parity.ok) {
    return parity;
  }

  active = implementation;

  activeName = name;

  return { ok: true };
}

export function activeScryptName(): string {
  return activeName;
}

export function resetScryptImplementation(): void {
  active = jsScrypt;

  activeName = "js";
}

export function scryptKdf(
  password: Uint8Array,
  salt: Uint8Array,
  params: ScryptParams,
): Uint8Array {
  return active(password, salt, params);
}
