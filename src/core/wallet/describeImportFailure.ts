// Only `importWallet` rejects the words themselves. Everything else that can
// fail on the import path — storage, the vault, a wallet that could not be
// saved durably — says nothing about what the user typed, and calling a
// correct phrase invalid sends them looking for a problem that is not theirs.
export function describeImportFailure(error: unknown): string {
  if (error instanceof Error && error.message === "Invalid mnemonic") {
    return "Invalid recovery phrase";
  }

  return "This phrase could not be saved on this device. Check Manage wallets before trying again.";
}
