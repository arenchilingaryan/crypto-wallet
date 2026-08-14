import * as SecureStore from "expo-secure-store";

import { expoRandomSource } from "./expoRandomSource";

const DEVICE_KEY = "security.device-key.v1";

const WRITE_OPTIONS = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
} as const;

let cached: Uint8Array | null = null;

function toBytes(hex: string) {
  const bytes = new Uint8Array(hex.length / 2);

  for (let index = 0; index < bytes.length; index++) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }

  return bytes;
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function getDeviceKey(): Promise<Uint8Array> {
  if (cached) {
    return cached;
  }

  const stored = await SecureStore.getItemAsync(DEVICE_KEY);

  if (stored && stored.length === 64) {
    cached = toBytes(stored);

    return cached;
  }

  if (stored) {
    throw new Error(
      "This device's wallet key is damaged. Restore your wallets from their recovery phrase.",
    );
  }

  const fresh = await expoRandomSource.getBytes(32);

  await SecureStore.setItemAsync(DEVICE_KEY, toHex(fresh), WRITE_OPTIONS);

  cached = fresh;

  return cached;
}

export async function hasDeviceKey(): Promise<boolean> {
  return (await SecureStore.getItemAsync(DEVICE_KEY)) !== null;
}
