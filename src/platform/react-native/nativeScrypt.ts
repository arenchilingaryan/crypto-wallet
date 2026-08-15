import { Platform } from "react-native";

import {
  adoptScryptImplementation,
  type ScryptImplementation,
} from "@/core/security/scryptKdf";

// The PIN KDF is identical in algorithm, parameters and salts whichever engine
// computes it — only the speed differs, and on a phone the difference is the
// whole user experience. Nothing about the stored vault or verifier changes
// here, so there is no migration and no new format.
//
// Adoption is conditional on proving byte-for-byte agreement with the
// implementation that wrote every existing vault. If the native module is
// missing (web, Expo Go) or disagrees for any reason, the JS implementation
// keeps running and the wallet behaves exactly as before — slow, but correct.
// Being locked out of your own wallet by a "faster" KDF is not a trade anyone
// would take.

export type NativeScryptOutcome =
  | { adopted: true }
  | { adopted: false; reason: string };

export function installNativeScrypt(): NativeScryptOutcome {
  if (Platform.OS === "web") {
    return {
      adopted: false,
      reason: "the web build has no native module and uses the JS engine",
    };
  }

  let scryptSync: unknown;

  try {
    // Deliberately the scrypt module alone, not the package root. The root entry
    // re-implements Node's whole crypto surface and drags in stream and buffer
    // polyfills, one of which (readable-stream) does not resolve under Metro and
    // breaks the bundle outright. This module needs only three things — the
    // native binding, a Buffer and small helpers — and pulls in nothing else.
    //
    // Metro resolves require() literals when it bundles, not at runtime, so
    // there can be no second path to fall back to here: a fallback literal
    // would be bundled too, and would reintroduce exactly what we are avoiding.
    // The whole file is still guarded because the native binding itself can be
    // absent (Expo Go), and the wallet must keep working on the JS engine.
    const scryptModule = require("react-native-quick-crypto/src/scrypt") as {
      scryptSync?: unknown;
      default?: { scryptSync?: unknown };
    };

    scryptSync = scryptModule.scryptSync ?? scryptModule.default?.scryptSync;
  } catch (error) {
    return {
      adopted: false,
      reason: `native crypto module is unavailable: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    };
  }

  if (typeof scryptSync !== "function") {
    return {
      adopted: false,
      reason: "native crypto module does not expose scryptSync",
    };
  }

  const native = scryptSync as (
    password: Uint8Array,
    salt: Uint8Array,
    keylen: number,
    options: { N: number; r: number; p: number },
  ) => Uint8Array;

  const implementation: ScryptImplementation = (password, salt, params) => {
    const derived = native(password, salt, params.dkLen, {
      N: params.N,
      r: params.r,
      p: params.p,
    });

    // Copy into a plain Uint8Array: downstream code hashes and compares these
    // bytes, and a Buffer subclass with its own prototype has no business
    // leaking into the crypto path.
    return Uint8Array.from(derived);
  };

  const parity = adoptScryptImplementation("native", implementation);

  if (!parity.ok) {
    console.error(
      "Native scrypt rejected, keeping the JS implementation:",
      parity.reason,
    );

    return { adopted: false, reason: parity.reason };
  }

  return { adopted: true };
}
