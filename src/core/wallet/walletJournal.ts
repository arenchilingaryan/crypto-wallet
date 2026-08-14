import type { Address } from "viem";

import type { WalletAccount } from "./walletEngine";

export type WalletJournalEntry = {
  op: "create" | "remove";

  walletId: string;

  address: Address;

  name: string;

  before: string;

  after: string;

  writtenAt: number;
};

export const JOURNAL_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function isJournalStale(entry: WalletJournalEntry, now: number) {
  return (
    !Number.isFinite(entry.writtenAt) ||
    entry.writtenAt > now + 60_000 ||
    now - entry.writtenAt > JOURNAL_MAX_AGE_MS
  );
}

export function fingerprintRegistry(wallets: WalletAccount[]): string {
  return wallets
    .map((wallet) => wallet.id.toLowerCase())
    .sort()
    .join(",");
}

export function serializeWalletJournal(entry: WalletJournalEntry): string {
  return JSON.stringify(entry);
}

export function parseWalletJournal(
  raw: string | null,
): WalletJournalEntry | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<WalletJournalEntry>;

    if (
      typeof parsed?.walletId !== "string" ||
      parsed.walletId.length === 0 ||
      typeof parsed.address !== "string" ||
      typeof parsed.name !== "string" ||
      typeof parsed.before !== "string" ||
      typeof parsed.after !== "string" ||
      typeof parsed.writtenAt !== "number" ||
      (parsed.op !== "create" && parsed.op !== "remove")
    ) {
      return null;
    }

    return {
      op: parsed.op,

      walletId: parsed.walletId,

      address: parsed.address as Address,

      name: parsed.name,

      before: parsed.before,

      after: parsed.after,

      writtenAt: parsed.writtenAt,
    };
  } catch {
    return null;
  }
}
