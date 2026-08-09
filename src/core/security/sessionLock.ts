let locked = true;

export class WalletLockedError extends Error {
  constructor() {
    super("Wallet is locked");
    this.name = "WalletLockedError";
  }
}

export function lockSession() {
  locked = true;
}

export function unlockSession() {
  locked = false;
}

export function isSessionLocked() {
  return locked;
}

export function assertSessionUnlocked() {
  if (locked) {
    throw new WalletLockedError();
  }
}
