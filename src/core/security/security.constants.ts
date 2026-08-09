export const SECURITY_STORAGE_KEYS = {
  pinSalt: "security.pin.salt.v1",
  pinHash: "security.pin.hash.v1",
  failedAttempts: "security.pin.failed-attempts.v1",
  blockedUntil: "security.pin.blocked-until.v1",
} as const;

export const PIN_LENGTH = 6;

export const MAX_PIN_ATTEMPTS = 5;

export const PIN_LOCKOUT_MS = 30_000;
