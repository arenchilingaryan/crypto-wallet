import { entropyToMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { mnemonicToAccount } from "viem/accounts";

import type { RandomSource } from "./ports/randomSource";

interface GenerateWalletDependencies {
  random: RandomSource;
}

export async function generateWallet({ random }: GenerateWalletDependencies) {
  const entropy = await random.getBytes(16);

  const mnemonic = entropyToMnemonic(entropy, wordlist);

  const account = mnemonicToAccount(mnemonic);

  return {
    mnemonic,
    address: account.address,
  };
}
