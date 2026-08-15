import AsyncStorage from "@react-native-async-storage/async-storage";

import type { Hash } from "viem";

import type { TrackedTransaction } from "@/core/transactions/trackedTransaction";
import { parseTrackedTransactions } from "@/core/transactions/trackedTransactionState";
import { freeQuarantineKey } from "@/core/storage/quarantineKey";

const STORAGE_KEY = "transactions.tracked.v1";

// Where an unreadable record is parked when the user explicitly chooses to
// start a fresh one. It is kept, not deleted: it is the only remaining
// evidence of transfers this device may still be responsible for.
const QUARANTINE_KEY = "transactions.tracked.v1.unreadable";

async function readAll(): Promise<TrackedTransaction[]> {
  return parseTrackedTransactions(await AsyncStorage.getItem(STORAGE_KEY));
}

// Everything parked by an earlier repair, so the screen can offer to let go of
// copies once they are no longer worth keeping — without which
// `QuarantineFullError` names a way out that does not exist.
export async function keptUnreadableRecords(): Promise<string[]> {
  const keys = await AsyncStorage.getAllKeys();

  return keys.filter(
    (key) => key === QUARANTINE_KEY || key.startsWith(`${QUARANTINE_KEY}.`),
  );
}

export async function forgetKeptUnreadableRecords(): Promise<number> {
  const keys = await keptUnreadableRecords();

  await AsyncStorage.multiRemove(keys);

  return keys.length;
}

export async function trackedTransactionsReadable(): Promise<boolean> {
  try {
    await readAll();

    return true;
  } catch {
    return false;
  }
}

// Replacing a record that can be read discards transfers this device knows
// about and hands back whatever they counted towards today's limit. Refused
// here rather than in the screen, so the guarantee does not depend on which
// button is currently rendered.
export class ReadableTrackedTransactionsError extends Error {
  constructor() {
    super(
      "These transactions can be read, so there is nothing to repair. Replacing them would hand back part of today's limit.",
    );

    this.name = "ReadableTrackedTransactionsError";
  }
}

async function writeAll(transactions: TrackedTransaction[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

let writeQueue: Promise<unknown> = Promise.resolve();

function serializeWrite<T>(task: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(task, task);

  writeQueue = run.then(
    () => undefined,
    () => undefined,
  );

  return run;
}

// The explicit recovery action. Nothing calls this on its own: an unreadable
// record keeps failing closed until the user chooses this, because starting a
// fresh record resets the outflow this device can account for.
//
// Runs inside the same write queue as every other mutation, and reads the raw
// value once: checking readability with a second read would let a legitimate
// write land in between and be destroyed unparked.
export async function quarantineTrackedTransactions(): Promise<void> {
  return serializeWrite(async () => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);

    try {
      parseTrackedTransactions(raw);

      throw new ReadableTrackedTransactionsError();
    } catch (error) {
      if (error instanceof ReadableTrackedTransactionsError) {
        throw error;
      }
    }

    // Parked first, and never over an earlier copy: a crash between the two
    // writes must not be able to lose the only remaining evidence.
    await AsyncStorage.setItem(
      await freeQuarantineKey(QUARANTINE_KEY, (key) =>
        AsyncStorage.getItem(key),
      ),
      raw as string,
    );

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([]));
  });
}

export async function listTrackedTransactions() {
  return readAll();
}

export async function saveTrackedTransaction(transaction: TrackedTransaction) {
  return serializeWrite(async () => {
    const current = await readAll();

    const next = current.filter(
      (item) => item.hash.toLowerCase() !== transaction.hash.toLowerCase(),
    );

    next.unshift(transaction);

    await writeAll(next);

    return transaction;
  });
}

export async function updateTrackedTransaction(
  hash: Hash,
  update: Partial<TrackedTransaction>,
) {
  return serializeWrite(async () => {
    const current = await readAll();

    const next = current.map((transaction) => {
      if (transaction.hash.toLowerCase() !== hash.toLowerCase()) {
        return transaction;
      }

      return {
        ...transaction,
        ...update,
        hash: transaction.hash,

        version: transaction.version,
      };
    });

    await writeAll(next);
  });
}

export async function removeTrackedTransaction(hash: Hash) {
  return serializeWrite(async () => {
    const current = await readAll();

    const next = current.filter(
      (transaction) => transaction.hash.toLowerCase() !== hash.toLowerCase(),
    );

    await writeAll(next);
  });
}

export async function getTrackedTransaction(
  hash: Hash,
): Promise<TrackedTransaction | null> {
  const transactions = await readAll();

  return (
    transactions.find(
      (transaction) => transaction.hash.toLowerCase() === hash.toLowerCase(),
    ) ?? null
  );
}
