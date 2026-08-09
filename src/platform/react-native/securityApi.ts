import * as Crypto from "expo-crypto";

import { createPin, hasPin, verifyPin } from "@/core/security/pin";

import {
    isSessionLocked,
    lockSession,
    unlockSession,
} from "@/core/security/sessionLock";

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
    lockSession();
  },

  isLocked() {
    return isSessionLocked();
  },
};
