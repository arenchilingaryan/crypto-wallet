import { validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { mnemonicToAccount } from "viem/accounts";

export function importWallet(mnemonic: string) {
  const normalizedMnemonic = mnemonic.trim().toLowerCase().replace(/\s+/g, " ");

  const isValid = validateMnemonic(normalizedMnemonic, wordlist);

  if (!isValid) {
    throw new Error("Invalid mnemonic");
  }

  const account = mnemonicToAccount(normalizedMnemonic);

  return {
    mnemonic: normalizedMnemonic,
    address: account.address,
  };
}
