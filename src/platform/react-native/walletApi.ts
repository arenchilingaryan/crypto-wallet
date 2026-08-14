import { confirmMnemonic } from "@/core/wallet/confirmMnemonic";

import { assertSessionUnlocked } from "@/core/security/sessionLock";
import {
  revealSecret,
  type RevealedSecret,
} from "@/core/wallet/revealSecret";

import { walletEngine } from "./compositionRoot";
import { panicApi } from "./panicApi";
import { expoSecretStore } from "./secretStore";

export const walletApi = {
  prepare() {
    return walletEngine.prepare();
  },

  create(recoveryPhrase: string) {
    return walletEngine.create(recoveryPhrase);
  },

  importFromMnemonic(mnemonic: string) {
    return walletEngine.importFromMnemonic(mnemonic);
  },

  load() {
    return walletEngine.getActive();
  },

  health() {
    return walletEngine.getHealth();
  },

  async reveal(): Promise<RevealedSecret> {
    assertSessionUnlocked();

    await panicApi.assertNotFrozen();

    const wallet = await walletEngine.getActive();

    if (!wallet) {
      throw new Error("Active wallet not found");
    }

    const secret = await expoSecretStore.load(wallet.id);

    if (!secret) {
      throw new Error(
        "This wallet has no recovery phrase stored on this device",
      );
    }

    return revealSecret(secret.mnemonic, wallet.address);
  },

  list() {
    return walletEngine.list();
  },

  setActive(walletId: string) {
    return walletEngine.setActive(walletId);
  },

  remove(walletId: string) {
    return walletEngine.remove(walletId);
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
