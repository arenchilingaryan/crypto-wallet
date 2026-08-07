import { removeWallet } from "@/src/core/wallet/removeWallet";
import { confirmMnemonic } from "../../core/wallet/confirmMnemonic";
import { generateWallet } from "../../core/wallet/generateWallet";
import { loadWallet } from "../../core/wallet/loadWallet";
import { persistWallet } from "../../core/wallet/persistWallet";

import { importWallet } from "@/src/core/wallet/importWallet";
import { expoRandomSource } from "./expoRandomSource";
import { expoSecretStorage } from "./expoSecretStorage";

export const walletApi = {
  generate() {
    return generateWallet({
      random: expoRandomSource,
    });
  },

  persist(mnemonic: string) {
    return persistWallet({ mnemonic }, { storage: expoSecretStorage });
  },

  load() {
    return loadWallet(expoSecretStorage);
  },

  remove() {
    return removeWallet(expoSecretStorage);
  },

  import(mnemonic: string) {
    return importWallet(mnemonic);
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
