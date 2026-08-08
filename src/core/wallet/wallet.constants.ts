export const WALLET_STORAGE_KEYS = {
  registry: "wallet.registry.v1",
  activeWalletId: "wallet.active.v1",

  legacyMnemonic: "wallet.mnemonic.v1",
} as const;

export function getWalletSecretKey(walletId: string) {
  return `wallet.secret.${walletId}`;
}
