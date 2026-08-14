import type { KeyValueStorage } from "../../core/ports/keyValueStorage";

export const expoKeyValueStorage: KeyValueStorage = {
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
