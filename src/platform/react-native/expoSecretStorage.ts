import * as SecureStore from "expo-secure-store";

import type { SecretStorage } from "../../core/wallet/ports/secretStorage";

export const expoSecretStorage: SecretStorage = {
  get(key) {
    return SecureStore.getItemAsync(key);
  },

  set(key, value) {
    return SecureStore.setItemAsync(key, value);
  },

  remove(key) {
    return SecureStore.deleteItemAsync(key);
  },
};
