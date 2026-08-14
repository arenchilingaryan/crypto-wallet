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
import { expoKeyValueStorage } from "./keyValueStorage";
import { outflowGuardApi } from "./outflowGuardApi";
import { policyApi } from "./policyApi";
import type { TimingReporter } from "./timings";
import { clearUnlockMaterial } from "./unlockMaterial";
import { adoptPin, sealEveryWallet, stageNewPin } from "./vaultKeeper";

async function hash(value: string) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value);
}

const dependencies = {
  storage: expoKeyValueStorage,
  random: expoRandomSource,
  hash,
};

export const securityApi = {
  hasPin() {
    return hasPin(expoKeyValueStorage);
  },

  async unlockWhenNoPin() {
    const configured = await hasPin(expoKeyValueStorage);

    if (configured) {
      return false;
    }

    unlockSession();

    return true;
  },

  async reauthorizeTransaction(
    pin: string,
    transaction: AuthorizableTransaction,
    outflow?: { amountUsd: number | null },
  ) {
    assertSessionUnlocked();

    const result = await verifyPin(pin, dependencies);

    if (!result.ok) {
      return result;
    }

    await adoptPin(pin);

    const tokenBytes = await expoRandomSource.getBytes(32);

    const authorization = bytesToHex(tokenBytes);

    let reservationId: string | null = null;

    if (outflow) {
      const policy = await policyApi.load();

      const hold = await outflowGuardApi.hold({
        id: authorization,

        amountUsd: outflow.amountUsd,

        limitUsd: policy.dailyOutflowLimitUsd,
      });

      if (!hold.ok) {
        return {
          ok: false as const,
          reason: "outflow-reserved" as const,
          message: hold.message,
        };
      }

      reservationId = hold.id;
    }

    grantTransactionAuthorization(transaction, authorization);

    return {
      ok: true as const,
      authorization,
      reservationId,
    };
  },

  async releaseOutflow(reservationId: string | null) {
    await outflowGuardApi.release(reservationId);
  },

  async setupPin(pin: string) {
    await createPin(pin, dependencies);

    await adoptPin(pin);

    unlockSession();

    await sealEveryWallet();
  },

  async replacePin(pin: string) {
    const vaultSalt = await stageNewPin(pin);

    await createPin(pin, dependencies, vaultSalt);

    await adoptPin(pin);

    unlockSession();
  },

  async verifyCurrentPin(pin: string, timing?: TimingReporter) {
    const result = await verifyPin(pin, dependencies);

    timing?.step("verify");

    if (result.ok) {
      await adoptPin(pin);

      timing?.step("vault");
    }

    return result;
  },

  async unlock(pin: string, timing?: TimingReporter) {
    const result = await verifyPin(pin, dependencies);

    timing?.step("verify");

    if (result.ok) {
      await adoptPin(pin);

      timing?.step("vault");

      unlockSession();

      await sealEveryWallet();

      timing?.step("seal");
    }

    return result;
  },

  lock() {
    clearTransactionAuthorization();
    clearUnlockMaterial();
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
