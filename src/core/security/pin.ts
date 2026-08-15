import type { RandomSource } from "@/core/ports/randomSource";
import type { KeyValueStorage } from "@/core/ports/keyValueStorage";

import {
  createPinVerifier,
  derivePinHash,
  deriveVaultPinKey,
  deriveVerifierHashFromVaultKey,
  parsePinVerifier,
  safeEqual,
  serializePinVerifier,
} from "./pinVerifier";

import {
  MAX_PIN_ATTEMPTS,
  PIN_LENGTH,
  PIN_LOCKOUT_MS,
  SECURITY_STORAGE_KEYS,
} from "./security.constants";

type PinDependencies = {
  storage: KeyValueStorage;
  random: RandomSource;
  hash: (value: string) => Promise<string>;
};

let verificationQueue: Promise<unknown> = Promise.resolve();

function serializeVerification<T>(task: () => Promise<T>): Promise<T> {
  const run = verificationQueue.then(task, task);

  verificationQueue = run.then(
    () => undefined,
    () => undefined,
  );

  return run;
}

export type VerifyPinResult =
  | {
      ok: true;

      // Present when the check itself derived the vault key (verifier v3), so
      // the caller can open the vault without paying for a second password KDF.
      // Absent on the legacy path, where the check used its own salt.
      vaultPinKey?: Uint8Array;
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
    }
  | {
      ok: false;
      reason: "unusable";
    };

export function describePinFailure(
  result: Extract<VerifyPinResult, { ok: false }>,
): string {
  switch (result.reason) {
    case "locked":
      return `Too many attempts. Try again in ${Math.ceil(
        result.retryAfterMs / 1000,
      )}s.`;

    case "unusable":
      return "The stored PIN cannot be read on this device. Restore this wallet from its recovery phrase.";

    case "invalid":
      return `Wrong PIN. ${result.attemptsLeft} attempts left.`;
  }
}

function validatePin(pin: string) {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function hasPin(storage: KeyValueStorage): Promise<boolean> {
  const verifier = await storage.get(SECURITY_STORAGE_KEYS.pinVerifier);

  if (verifier !== null) {
    return true;
  }

  const legacyHash = await storage.get(SECURITY_STORAGE_KEYS.legacyPinHash);

  const legacySalt = await storage.get(SECURITY_STORAGE_KEYS.legacyPinSalt);

  return Boolean(legacyHash && legacySalt);
}

async function clearLegacyPin(storage: KeyValueStorage) {
  await storage.remove(SECURITY_STORAGE_KEYS.legacyPinSalt);

  await storage.remove(SECURITY_STORAGE_KEYS.legacyPinHash);
}

export async function createPin(
  pin: string,
  { storage, random }: PinDependencies,
  presetVaultSalt?: string,
): Promise<void> {
  if (!validatePin(pin)) {
    throw new Error(`PIN must contain exactly ${PIN_LENGTH} digits`);
  }

  const salt = bytesToHex(await random.getBytes(16));

  const vaultSalt =
    presetVaultSalt ?? bytesToHex(await random.getBytes(16));

  await storage.set(
    SECURITY_STORAGE_KEYS.pinVerifier,
    serializePinVerifier(createPinVerifier(pin, salt, vaultSalt)),
  );

  await clearLegacyPin(storage);

  await storage.remove(SECURITY_STORAGE_KEYS.failedAttempts);

  await storage.remove(SECURITY_STORAGE_KEYS.blockedUntil);
}

export async function verifyPin(
  pin: string,
  dependencies: PinDependencies,
): Promise<VerifyPinResult> {
  return serializeVerification(() => verifyPinInQueue(pin, dependencies));
}

async function verifyPinInQueue(
  pin: string,
  { storage, hash, random }: PinDependencies,
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
    blockedUntilValue !== null && blockedUntilValue.trim() !== ""
      ? Number(blockedUntilValue)
      : 0;

  const now = Date.now();

  if (
    blockedUntilValue !== null &&
    blockedUntilValue.trim() !== "" &&
    !Number.isFinite(blockedUntil)
  ) {
    return enterLockout(storage, now);
  }

  if (blockedUntil > now) {
    return {
      ok: false,
      reason: "locked",
      retryAfterMs: blockedUntil - now,
    };
  }

  const storedVerifier = await storage.get(SECURITY_STORAGE_KEYS.pinVerifier);

  const verifier = parsePinVerifier(storedVerifier);

  if (storedVerifier !== null && !verifier) {
    return { ok: false, reason: "unusable" };
  }

  let matched: boolean;

  let vaultPinKey: Uint8Array | undefined;

  if (verifier) {
    if (verifier.version === 3) {
      // The single expensive step of the whole unlock.
      const derived = deriveVaultPinKey(pin, verifier.vaultSalt);

      matched = safeEqual(
        deriveVerifierHashFromVaultKey(derived),
        verifier.hash,
      );

      if (matched) {
        vaultPinKey = derived;
      }
    } else {
      matched = safeEqual(
        derivePinHash(pin, verifier.salt, {
          N: verifier.N,
          r: verifier.r,
          p: verifier.p,
        }),
        verifier.hash,
      );
    }

    if (matched) {
      await clearLegacyPin(storage);
    }
  } else {
    const legacySalt = await storage.get(SECURITY_STORAGE_KEYS.legacyPinSalt);

    const legacyHash = await storage.get(SECURITY_STORAGE_KEYS.legacyPinHash);

    if (!legacySalt || !legacyHash) {
      return { ok: false, reason: "unusable" };
    }

    matched = safeEqual(await hash(`${legacySalt}:${pin}`), legacyHash);

    if (matched) {
      const salt = bytesToHex(await random.getBytes(16));

      const vaultSalt = bytesToHex(await random.getBytes(16));

      await storage.set(
        SECURITY_STORAGE_KEYS.pinVerifier,
        serializePinVerifier(createPinVerifier(pin, salt, vaultSalt)),
      );

      await clearLegacyPin(storage);
    }
  }

  if (matched) {
    await storage.remove(SECURITY_STORAGE_KEYS.failedAttempts);

    await storage.remove(SECURITY_STORAGE_KEYS.blockedUntil);

    return {
      ok: true,

      vaultPinKey,
    };
  }

  const attemptsValue = await storage.get(SECURITY_STORAGE_KEYS.failedAttempts);

  const previousAttempts = parseAttemptCount(attemptsValue);

  if (previousAttempts === null) {
    return enterLockout(storage, Date.now());
  }

  const attempts = previousAttempts + 1;

  if (attempts >= MAX_PIN_ATTEMPTS) {
    return enterLockout(storage, Date.now());
  }

  await storage.set(SECURITY_STORAGE_KEYS.failedAttempts, String(attempts));

  return {
    ok: false,
    reason: "invalid",
    attemptsLeft: MAX_PIN_ATTEMPTS - attempts,
  };
}

function parseAttemptCount(value: string | null): number | null {
  if (value === null) {
    return 0;
  }

  if (value.trim() === "") {
    return null;
  }

  const parsed = Number(value);

  return Number.isSafeInteger(parsed) &&
    parsed >= 0 &&
    parsed <= MAX_PIN_ATTEMPTS
    ? parsed
    : null;
}

async function enterLockout(
  storage: KeyValueStorage,
  now: number,
): Promise<Extract<VerifyPinResult, { ok: false; reason: "locked" }>> {
  await storage.set(
    SECURITY_STORAGE_KEYS.failedAttempts,
    String(MAX_PIN_ATTEMPTS),
  );

  await storage.set(
    SECURITY_STORAGE_KEYS.blockedUntil,
    String(now + PIN_LOCKOUT_MS),
  );

  return {
    ok: false,
    reason: "locked",
    retryAfterMs: PIN_LOCKOUT_MS,
  };
}
