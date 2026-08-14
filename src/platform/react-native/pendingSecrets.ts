import type { WalletSecret } from "@/core/wallet/walletSecret";

const pending = new Map<string, WalletSecret>();

export function stagePendingSecret(walletId: string, secret: WalletSecret) {
  pending.set(walletId, secret);
}

export function peekPendingSecret(walletId: string): WalletSecret | null {
  return pending.get(walletId) ?? null;
}

export function clearPendingSecret(walletId: string) {
  pending.delete(walletId);
}

export function pendingSecretEntries(): [string, WalletSecret][] {
  return [...pending.entries()];
}

export function clearAllPendingSecrets() {
  pending.clear();
}
