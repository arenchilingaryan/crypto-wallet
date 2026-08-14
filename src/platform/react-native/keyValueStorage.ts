import * as SecureStore from "expo-secure-store";

import type { KeyValueStorage } from "../../core/ports/keyValueStorage";

const WRITE_OPTIONS = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
} as const;

export const expoKeyValueStorage: KeyValueStorage = {
  get(key) {
    return SecureStore.getItemAsync(key);
  },

  set(key, value) {
    return SecureStore.setItemAsync(key, value, WRITE_OPTIONS);
  },

  remove(key) {
    return SecureStore.deleteItemAsync(key);
  },
};
