let pinKey: Uint8Array | null = null;

export function setUnlockMaterial(key: Uint8Array) {
  pinKey = key;
}

export function getUnlockMaterial(): Uint8Array | null {
  return pinKey;
}

export function clearUnlockMaterial() {
  if (pinKey) {
    pinKey.fill(0);
  }

  pinKey = null;
}
