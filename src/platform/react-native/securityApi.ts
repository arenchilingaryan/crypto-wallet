import * as Crypto from "expo-crypto";

import type { AuthorizableTransaction } from "@/core/security/transactionAuthorization";

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

  // Без настроенного PIN экрана разблокировки нет, поэтому доменную сессию
  // некому открыть — а sessionLock стартует запертым. Открываем её явно,
  // но только пока PIN действительно не задан.
  async unlockWhenNoPin() {
    const configured = await hasPin(expoSecretStorage);

    if (configured) {
      return false;
    }

    unlockSession();

    return true;
  },

  async reauthorizeTransaction(
    pin: string,
    transaction: AuthorizableTransaction,
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

  // Проверка текущего PIN без побочных эффектов на сессию —
  // для флоу смены PIN в настройках. Лимиты попыток общие с unlock.
  verifyCurrentPin(pin: string) {
    return verifyPin(pin, dependencies);
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
