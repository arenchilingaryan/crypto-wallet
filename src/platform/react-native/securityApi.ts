import * as Crypto from "expo-crypto";

import type { PreparedNativeTransfer } from "@/core/transactions/nativeTransfer";

import {
  assertSessionUnlocked,
  isSessionLocked,
  lockSession,
  unlockSession,
} from "@/core/security/sessionLock";

import {
  clearTransactionAuthorization,
  grantTransactionAuthorization,
} from "@/core/security/transactionAuthorization";

import { createPin, hasPin, verifyPin } from "@/core/security/pin";



import { expoRandomSource } from "./expoRandomSource";
import { expoSecretStorage } from "./expoSecretStorage";

async function hash(value: string) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value);
}

const dependencies = {
  storage: expoSecretStorage,
  random: expoRandomSource,
  hash,
};

export const securityApi = {
  hasPin() {
    return hasPin(expoSecretStorage);
  },

  async reauthorizeTransaction(
    pin: string,
    transaction: PreparedNativeTransfer,
  ) {
    assertSessionUnlocked();

    const result = await verifyPin(pin, dependencies);

    if (!result.ok) {
      return result;
    }

    const tokenBytes = await expoRandomSource.getBytes(32);

    const authorization = bytesToHex(tokenBytes);

    grantTransactionAuthorization(transaction, authorization);

    return {
      ok: true as const,
      authorization,
    };
  },

  async setupPin(pin: string) {
    await createPin(pin, dependencies);

    unlockSession();
  },

  async unlock(pin: string) {
    const result = await verifyPin(pin, dependencies);

    if (result.ok) {
      unlockSession();
    }

    return result;
  },

  lock() {
    clearTransactionAuthorization();
    lockSession();
  },

  isLocked() {
    return isSessionLocked();
  },
};

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
