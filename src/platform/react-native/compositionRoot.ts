import { createLocalMnemonicSigner } from "@/core/signing/localMnemonicSigner";
import { createWalletEngine } from "@/core/wallet/walletEngine";

import { installNativeScrypt } from "./nativeScrypt";

import { expoKeyValueStorage } from "./keyValueStorage";

// Before anything can derive a PIN key. Adoption is self-verifying and falls
// back to the JS engine, so this is safe to run unconditionally at startup.
export const nativeScrypt = installNativeScrypt();
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
