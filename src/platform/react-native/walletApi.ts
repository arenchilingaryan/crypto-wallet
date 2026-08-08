import { confirmMnemonic } from "../../core/wallet/confirmMnemonic";
import { generateWallet } from "../../core/wallet/generateWallet";
import { importWallet } from "../../core/wallet/importWallet";
import {
  addWallet,
  getActiveWallet,
  listWallets,
  removeWallet,
  setActiveWallet,
} from "../../core/wallet/walletStore";

import { expoRandomSource } from "./expoRandomSource";
import { expoSecretStorage } from "./expoSecretStorage";

export const walletApi = {
  generate() {
    return generateWallet({
      random: expoRandomSource,
    });
  },

  import(mnemonic: string) {
    return importWallet(mnemonic);
  },

  persist(mnemonic: string) {
    return addWallet(mnemonic, expoSecretStorage);
  },

  load() {
    return getActiveWallet(expoSecretStorage);
  },

  list() {
    return listWallets(expoSecretStorage);
  },

  setActive(walletId: string) {
    return setActiveWallet(walletId, expoSecretStorage);
  },

  remove(walletId: string) {
    return removeWallet(walletId, expoSecretStorage);
  },

  confirmMnemonic(
    mnemonic: string,
    answers: {
      index: number;
      word: string;
    }[],
  ) {
    return confirmMnemonic(mnemonic, answers);
  },
};
