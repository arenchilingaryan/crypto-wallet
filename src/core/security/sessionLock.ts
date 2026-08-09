let locked = true;

export function lockSession() {
  locked = true;
}

export function unlockSession() {
  locked = false;
}

export function isSessionLocked() {
  return locked;
}
