import type { SecretStorage } from "../../core/wallet/ports/secretStorage";

/**
 * Web build of the secret storage port. expo-secure-store has no web
 * implementation, so the browser falls back to localStorage — fine for
 * development against a testnet, NOT a secure vault.
 */
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
