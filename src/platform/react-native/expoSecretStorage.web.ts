import type { SecretStorage } from "../../core/wallet/ports/secretStorage";

export const expoSecretStorage: SecretStorage = {
  async get(key) {
    return localStorage.getItem(key);
  },

  async set(key, value) {
    localStorage.setItem(key, value);
  },

  async remove(key) {
    localStorage.removeItem(key);
  },
};
