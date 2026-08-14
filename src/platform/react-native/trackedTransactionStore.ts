import AsyncStorage from "@react-native-async-storage/async-storage";

import type { Hash } from "viem";

import type { TrackedTransaction } from "@/core/transactions/trackedTransaction";

const STORAGE_KEY = "transactions.tracked.v1";

async function readAll(): Promise<TrackedTransaction[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed as TrackedTransaction[];
  } catch {
    return [];
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
