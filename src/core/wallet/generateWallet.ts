import {
  entropyToMnemonic,
  validateMnemonic,
} from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { mnemonicToAccount } from "viem/accounts";

import type { RandomSource } from "./ports/randomSource";

const MNEMONIC_ENTROPY_BYTES = 16;

interface GenerateWalletDependencies {
  random: RandomSource;
}

export async function generateWallet({
  random,
}: GenerateWalletDependencies) {
  const entropy = await random.getBytes(
    MNEMONIC_ENTROPY_BYTES,
  );

  if (
    !(entropy instanceof Uint8Array) ||
    entropy.length !== MNEMONIC_ENTROPY_BYTES
  ) {
    throw new Error(
      "Secure random source returned invalid entropy",
    );
  }

  const mnemonic = entropyToMnemonic(
    entropy,
    wordlist,
  );

  if (!validateMnemonic(mnemonic, wordlist)) {
    throw new Error(
      "Generated mnemonic failed validation",
    );
  }

  const account =
    mnemonicToAccount(mnemonic);

  return {
    mnemonic,
    address: account.address,
  };
}