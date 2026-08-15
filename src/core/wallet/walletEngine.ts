import { isAddress, type Address } from "viem";
import { mnemonicToAccount } from "viem/accounts";

import type { KeyValueStorage } from "@/core/ports/keyValueStorage";
import type { RandomSource } from "@/core/ports/randomSource";
import type { SecretStore } from "@/core/ports/secretStore";

import { generateWallet } from "./generateWallet";
import { importWallet } from "./importWallet";
import { WALLET_STORAGE_KEYS } from "./wallet.constants";
import {
  fingerprintRegistry,
  isJournalStale,
  parseWalletJournal,
  serializeWalletJournal,
  type WalletJournalEntry,
} from "./walletJournal";
import { createWalletSecret } from "./walletSecret";

export type WalletAccount = {
  id: string;

  name: string;

  address: Address;
};

export type ReconcileReport = {
  status: "ok" | "degraded";

  repaired: string[];

  walletsWithoutSecret: string[];
};

export class WalletStorageUnavailableError extends Error {
  constructor() {
    super(
      "Wallet storage is unavailable, so changing wallets is blocked until it can be read again",
    );

    this.name = "WalletStorageUnavailableError";
  }
}

// Raised when a wallet was asked for before there is anywhere durable to keep
// its recovery phrase. The caller still holds the phrase and can retry once
// the PIN and vault exist; nothing has been written.
export class WalletSecretNotDurableError extends Error {
  constructor() {
    super(
      "This wallet cannot be saved until a PIN is set, because there is nowhere yet to keep its recovery phrase.",
    );

    this.name = "WalletSecretNotDurableError";
  }
}

export interface WalletEngine {
  initialize(): Promise<ReconcileReport>;

  getHealth(): Promise<ReconcileReport>;

  prepare(): Promise<{ recoveryPhrase: string; address: Address }>;

  finishLegacyMigration(): Promise<void>;

  create(recoveryPhrase: string): Promise<WalletAccount>;

  importFromMnemonic(mnemonic: string): Promise<WalletAccount>;

  list(): Promise<WalletAccount[]>;

  getActive(): Promise<WalletAccount | null>;

  setActive(walletId: string): Promise<WalletAccount>;

  remove(walletId: string): Promise<WalletAccount | null>;
}

type WalletEngineDependencies = {
  storage: KeyValueStorage;

  secrets: SecretStore;

  random: RandomSource;
};

function createWalletId(address: Address) {
  return address.toLowerCase();
}

function getNextWalletName(wallets: WalletAccount[]) {
  const maxIndex = wallets.reduce((max, wallet) => {
    const match = /^Wallet (\d+)$/.exec(wallet.name);

    if (!match) {
      return max;
    }

    return Math.max(max, Number(match[1]));
  }, 0);

  return `Wallet ${maxIndex + 1}`;
}

function isWalletAccount(value: unknown): value is WalletAccount {
  if (!value || typeof value !== "object") {
    return false;
  }

  const wallet = value as Partial<WalletAccount>;

  return (
    typeof wallet.id === "string" &&
    wallet.id.length > 0 &&
    typeof wallet.name === "string" &&
    typeof wallet.address === "string" &&
    isAddress(wallet.address, { strict: false }) &&
    wallet.id.toLowerCase() === wallet.address.toLowerCase()
  );
}

export function createWalletEngine({
  storage,
  secrets,
  random,
}: WalletEngineDependencies): WalletEngine {
  let reconciliation: Promise<ReconcileReport> | null = null;

  let queue: Promise<unknown> = Promise.resolve();

  function serialize<T>(task: () => Promise<T>): Promise<T> {
    const run = queue.then(task, task);

    queue = run.then(
      () => undefined,
      () => undefined,
    );

    return run;
  }

  async function readRegistry(): Promise<WalletAccount[]> {
    const value = await storage.get(WALLET_STORAGE_KEYS.registry);

    if (value === null || value.trim() === "") {
      return [];
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(value);
    } catch {
      throw new WalletStorageUnavailableError();
    }

    if (!Array.isArray(parsed) || !parsed.every(isWalletAccount)) {
      throw new WalletStorageUnavailableError();
    }

    const walletIds = new Set(parsed.map((wallet) => wallet.id.toLowerCase()));

    if (walletIds.size !== parsed.length) {
      throw new WalletStorageUnavailableError();
    }

    return parsed;
  }

  async function writeRegistry(wallets: WalletAccount[]) {
    await storage.set(WALLET_STORAGE_KEYS.registry, JSON.stringify(wallets));
  }

  async function writeJournal(
    entry: Omit<WalletJournalEntry, "writtenAt">,
  ) {
    await storage.set(
      WALLET_STORAGE_KEYS.journal,
      serializeWalletJournal({ ...entry, writtenAt: Date.now() }),
    );
  }

  async function clearJournal() {
    await storage.remove(WALLET_STORAGE_KEYS.journal);
  }

  async function repairActive(wallets: WalletAccount[]) {
    const activeWalletId = await storage.get(
      WALLET_STORAGE_KEYS.activeWalletId,
    );

    if (wallets.length === 0) {
      if (activeWalletId !== null) {
        await storage.remove(WALLET_STORAGE_KEYS.activeWalletId);

        return true;
      }

      return false;
    }

    if (wallets.some((wallet) => wallet.id === activeWalletId)) {
      return false;
    }

    await storage.set(WALLET_STORAGE_KEYS.activeWalletId, wallets[0].id);

    return true;
  }

  async function migrateLegacyWallet() {
    const mnemonic = await storage.get(WALLET_STORAGE_KEYS.legacyMnemonic);

    if (!mnemonic) {
      return;
    }

    const account = mnemonicToAccount(mnemonic);

    const walletId = createWalletId(account.address);

    const wallets = await readRegistry();

    const name =
      wallets.find((wallet) => wallet.id === walletId)?.name ??
      getNextWalletName(wallets);

    const migrated = wallets.some((wallet) => wallet.id === walletId)
      ? wallets
      : [...wallets, { id: walletId, name, address: account.address }];

    await writeJournal({
      op: "create",

      walletId,

      address: account.address,

      name,

      before: fingerprintRegistry(wallets),

      after: fingerprintRegistry(migrated),
    });

    const { durable } = await secrets.save(
      walletId,
      createWalletSecret(mnemonic),
    );

    if (!wallets.some((wallet) => wallet.id === walletId)) {
      await writeRegistry([
        ...wallets,
        {
          id: walletId,
          name,
          address: account.address,
        },
      ]);
    }

    const activeWalletId = await storage.get(
      WALLET_STORAGE_KEYS.activeWalletId,
    );

    if (!activeWalletId) {
      await storage.set(WALLET_STORAGE_KEYS.activeWalletId, walletId);
    }

    if (durable) {
      await storage.remove(WALLET_STORAGE_KEYS.legacyMnemonic);
    }

    await clearJournal();
  }

  async function replayJournal(
    entry: WalletJournalEntry,
    repaired: string[],
  ): Promise<void> {
    const wallets = await readRegistry();

    const current = fingerprintRegistry(wallets);

    if (isJournalStale(entry, Date.now())) {
      repaired.push("discarded a journal entry that was too old to trust");

      await clearJournal();

      return;
    }

    if (current !== entry.before && current !== entry.after) {
      repaired.push(
        `discarded a journal entry written against a state that no longer exists`,
      );

      await clearJournal();

      return;
    }

    const interrupted = current === entry.before;

    if (entry.op === "remove") {
      if (interrupted) {
        const remaining = wallets.filter((item) => item.id !== entry.walletId);

        await writeRegistry(remaining);

        repaired.push(`removed ${entry.walletId} from the registry`);

        await repairActive(remaining);
      } else {
        await repairActive(wallets);
      }

      await secrets.remove(entry.walletId);

      await clearJournal();

      return;
    }

    let secret: Awaited<ReturnType<typeof secrets.load>>;

    try {
      secret = await secrets.load(entry.walletId);
    } catch {
      repaired.push(
        `left a journal entry for ${entry.walletId} until its wallet can be read`,
      );

      return;
    }

    if (secret === null) {
      await clearJournal();

      return;
    }

    if (interrupted && !wallets.some((item) => item.id === entry.walletId)) {
      const restored = [
        ...wallets,
        {
          id: entry.walletId,
          name: entry.name,
          address: entry.address,
        },
      ];

      await writeRegistry(restored);

      repaired.push(`restored ${entry.walletId} into the registry`);

      await repairActive(restored);
    } else {
      await repairActive(wallets);
    }

    await clearJournal();
  }

  async function reconcile(): Promise<ReconcileReport> {
    const repaired: string[] = [];

    try {
      const entry = parseWalletJournal(
        await storage.get(WALLET_STORAGE_KEYS.journal),
      );

      if (entry) {
        await replayJournal(entry, repaired);
      } else {
        await clearJournal();
      }

      await migrateLegacyWallet();

      const wallets = await readRegistry();

      if (await repairActive(wallets)) {
        repaired.push("pointed the active wallet at an existing wallet");
      }

      const probes = await Promise.all(
        wallets.map(async (wallet) => {
          try {
            return {
              id: wallet.id,
              missing: (await secrets.load(wallet.id)) === null,
            };
          } catch {
            return { id: wallet.id, missing: false };
          }
        }),
      );

      const walletsWithoutSecret = probes
        .filter((probe) => probe.missing)
        .map((probe) => probe.id);

      return { status: "ok", repaired, walletsWithoutSecret };
    } catch {
      return { status: "degraded", repaired, walletsWithoutSecret: [] };
    }
  }

  async function ensureReady(): Promise<ReconcileReport> {
    reconciliation ??= serialize(reconcile);

    const report = await reconciliation;

    if (report.status === "degraded") {
      reconciliation = null;
    }

    return report;
  }

  async function assertMutable() {
    const report = await ensureReady();

    if (report.status === "degraded") {
      throw new WalletStorageUnavailableError();
    }
  }

  async function addWallet(mnemonic: string): Promise<WalletAccount> {
    const account = mnemonicToAccount(mnemonic);

    const walletId = createWalletId(account.address);

    const wallets = await readRegistry();

    const existing = wallets.find((wallet) => wallet.id === walletId);

    const wallet: WalletAccount = existing ?? {
      id: walletId,

      name: getNextWalletName(wallets),

      address: account.address,
    };

    const nextRegistry = existing ? wallets : [...wallets, wallet];

    await writeJournal({
      op: "create",

      walletId: wallet.id,

      address: wallet.address,

      name: wallet.name,

      before: fingerprintRegistry(wallets),

      after: fingerprintRegistry(nextRegistry),
    });

    const { durable } = await secrets.save(
      wallet.id,
      createWalletSecret(mnemonic),
    );

    // The registry and the active pointer are what make a wallet exist to the
    // rest of the app. Writing them against a secret that lives only in
    // process memory produces a wallet that survives a crash while its phrase
    // does not: visible, selectable, and impossible to sign with. Roll the
    // whole operation back instead and leave nothing behind.
    if (!durable) {
      try {
        // Only the staged in-memory copy. `remove` would delete durable
        // storage, and this same wallet id may already own a sealed secret
        // from an earlier session — re-importing an existing phrase while the
        // vault is closed would then destroy the live wallet it belongs to.
        await secrets.discardStaged(wallet.id);
      } catch {
        // The staged copy dies with the process regardless. The registry is
        // the state that must stay clean.
      }

      await clearJournal();

      throw new WalletSecretNotDurableError();
    }

    if (!existing) {
      await writeRegistry([...wallets, wallet]);
    }

    await storage.set(WALLET_STORAGE_KEYS.activeWalletId, wallet.id);

    await clearJournal();

    return wallet;
  }

  return {
    initialize() {
      return ensureReady();
    },

    async getHealth() {
      const report = await ensureReady();

      if (report.status === "degraded") {
        return report;
      }

      return serialize(async () => {
        try {
          const wallets = await readRegistry();

          const probes = await Promise.all(
            wallets.map(async (wallet) => {
              try {
                return {
                  id: wallet.id,
                  missing: (await secrets.load(wallet.id)) === null,
                };
              } catch {
                return { id: wallet.id, missing: false };
              }
            }),
          );

          return {
            status: "ok" as const,

            repaired: report.repaired,

            walletsWithoutSecret: probes
              .filter((probe) => probe.missing)
              .map((probe) => probe.id),
          };
        } catch {
          return {
            status: "degraded" as const,
            repaired: report.repaired,
            walletsWithoutSecret: [],
          };
        }
      });
    },

    async prepare() {
      const generated = await generateWallet({ random });

      return {
        recoveryPhrase: generated.mnemonic,

        address: generated.address,
      };
    },

    async finishLegacyMigration() {
      await serialize(() => migrateLegacyWallet());
    },

    async create(recoveryPhrase: string) {
      const imported = importWallet(recoveryPhrase);

      await assertMutable();

      return serialize(() => addWallet(imported.mnemonic));
    },

    async importFromMnemonic(mnemonic: string) {
      const imported = importWallet(mnemonic);

      await assertMutable();

      return serialize(() => addWallet(imported.mnemonic));
    },

    async list() {
      await ensureReady();

      return readRegistry();
    },

    async getActive() {
      await ensureReady();

      const wallets = await readRegistry();

      if (wallets.length === 0) {
        return null;
      }

      const activeWalletId = await storage.get(
        WALLET_STORAGE_KEYS.activeWalletId,
      );

      const active = wallets.find((wallet) => wallet.id === activeWalletId);

      if (active) {
        return active;
      }

      return serialize(async () => {
        const current = await readRegistry();

        if (current.length === 0) {
          return null;
        }

        const pointer = await storage.get(WALLET_STORAGE_KEYS.activeWalletId);

        const settled = current.find((wallet) => wallet.id === pointer);

        if (settled) {
          return settled;
        }

        await storage.set(WALLET_STORAGE_KEYS.activeWalletId, current[0].id);

        return current[0];
      });
    },

    async setActive(walletId: string) {
      await assertMutable();

      return serialize(async () => {
        const wallets = await readRegistry();

        const wallet = wallets.find((item) => item.id === walletId);

        if (!wallet) {
          throw new Error("Wallet not found");
        }

        await storage.set(WALLET_STORAGE_KEYS.activeWalletId, wallet.id);

        return wallet;
      });
    },

    async remove(walletId: string) {
      await assertMutable();

      return serialize(async () => {
        const wallets = await readRegistry();

        const wallet = wallets.find((item) => item.id === walletId);

        if (!wallet) {
          throw new Error("Wallet not found");
        }

        const remaining = wallets.filter((item) => item.id !== walletId);

        await writeJournal({
          op: "remove",

          walletId: wallet.id,

          address: wallet.address,

          name: wallet.name,

          before: fingerprintRegistry(wallets),

          after: fingerprintRegistry(remaining),
        });

        await writeRegistry(remaining);

        const activeWalletId = await storage.get(
          WALLET_STORAGE_KEYS.activeWalletId,
        );

        let next: WalletAccount | null = null;

        if (remaining.length === 0) {
          await storage.remove(WALLET_STORAGE_KEYS.activeWalletId);
        } else if (activeWalletId === walletId) {
          next = remaining[0];

          await storage.set(WALLET_STORAGE_KEYS.activeWalletId, next.id);
        } else {
          next =
            remaining.find((item) => item.id === activeWalletId) ??
            remaining[0];
        }

        await secrets.remove(wallet.id);

        await clearJournal();

        return next;
      });
    },
  };
}
