import { createLocalMnemonicSigner } from "@/core/signing/localMnemonicSigner";
import { createWalletEngine } from "@/core/wallet/walletEngine";

import { expoKeyValueStorage } from "./keyValueStorage";
import { expoRandomSource } from "./expoRandomSource";
import { panicApi } from "./panicApi";
import { expoSecretStore } from "./secretStore";

export const walletEngine = createWalletEngine({
  storage: expoKeyValueStorage,

  secrets: expoSecretStore,

  random: expoRandomSource,
});

export const walletSigner = createLocalMnemonicSigner({
  engine: walletEngine,

  secrets: expoSecretStore,

  assertNotFrozen: () => panicApi.assertNotFrozen(),
});

export const keyValueStorage = expoKeyValueStorage;

export const randomSource = expoRandomSource;
