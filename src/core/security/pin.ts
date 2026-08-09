import type { RandomSource } from "@/core/wallet/ports/randomSource";
import type { SecretStorage } from "@/core/wallet/ports/secretStorage";

import {
    MAX_PIN_ATTEMPTS,
    PIN_LENGTH,
    PIN_LOCKOUT_MS,
    SECURITY_STORAGE_KEYS,
} from "./security.constants";

type PinDependencies = {
  storage: SecretStorage;
  random: RandomSource;
  hash: (value: string) => Promise<string>;
};

export type VerifyPinResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      reason: "invalid";
      attemptsLeft: number;
    }
  | {
      ok: false;
      reason: "locked";
      retryAfterMs: number;
    };

function validatePin(pin: string) {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) {
    return false;
  }

  let difference = 0;

  for (let index = 0; index < a.length; index++) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }

  return difference === 0;
}

export async function hasPin(storage: SecretStorage): Promise<boolean> {
  const hash = await storage.get(SECURITY_STORAGE_KEYS.pinHash);

  const salt = await storage.get(SECURITY_STORAGE_KEYS.pinSalt);

  return Boolean(hash && salt);
}

export async function createPin(
  pin: string,
  { storage, random, hash }: PinDependencies,
): Promise<void> {
  if (!validatePin(pin)) {
    throw new Error(`PIN must contain exactly ${PIN_LENGTH} digits`);
  }

  const saltBytes = await random.getBytes(16);

  const salt = bytesToHex(saltBytes);

  const pinHash = await hash(`${salt}:${pin}`);

  await storage.set(SECURITY_STORAGE_KEYS.pinSalt, salt);

  await storage.set(SECURITY_STORAGE_KEYS.pinHash, pinHash);

  await storage.remove(SECURITY_STORAGE_KEYS.failedAttempts);

  await storage.remove(SECURITY_STORAGE_KEYS.blockedUntil);
}

export async function verifyPin(
  pin: string,
  { storage, hash }: PinDependencies,
): Promise<VerifyPinResult> {
  if (!validatePin(pin)) {
    return {
      ok: false,
      reason: "invalid",
      attemptsLeft: MAX_PIN_ATTEMPTS,
    };
  }

  const blockedUntilValue = await storage.get(
    SECURITY_STORAGE_KEYS.blockedUntil,
  );

  const blockedUntil =
    blockedUntilValue !== null ? Number(blockedUntilValue) : 0;

  const now = Date.now();

  if (Number.isFinite(blockedUntil) && blockedUntil > now) {
    return {
      ok: false,
      reason: "locked",
      retryAfterMs: blockedUntil - now,
    };
  }

  const salt = await storage.get(SECURITY_STORAGE_KEYS.pinSalt);

  const expectedHash = await storage.get(SECURITY_STORAGE_KEYS.pinHash);

  if (!salt || !expectedHash) {
    throw new Error("PIN is not configured");
  }

  const actualHash = await hash(`${salt}:${pin}`);

  if (safeEqual(actualHash, expectedHash)) {
    await storage.remove(SECURITY_STORAGE_KEYS.failedAttempts);

    await storage.remove(SECURITY_STORAGE_KEYS.blockedUntil);

    return {
      ok: true,
    };
  }

  const attemptsValue = await storage.get(SECURITY_STORAGE_KEYS.failedAttempts);

  const attempts = attemptsValue !== null ? Number(attemptsValue) + 1 : 1;

  if (attempts >= MAX_PIN_ATTEMPTS) {
    const nextBlockedUntil = Date.now() + PIN_LOCKOUT_MS;

    await storage.set(SECURITY_STORAGE_KEYS.failedAttempts, "0");

    await storage.set(
      SECURITY_STORAGE_KEYS.blockedUntil,
      String(nextBlockedUntil),
    );

    return {
      ok: false,
      reason: "locked",
      retryAfterMs: PIN_LOCKOUT_MS,
    };
  }

  await storage.set(SECURITY_STORAGE_KEYS.failedAttempts, String(attempts));

  return {
    ok: false,
    reason: "invalid",
    attemptsLeft: MAX_PIN_ATTEMPTS - attempts,
  };
}
