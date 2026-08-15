import AsyncStorage from "@react-native-async-storage/async-storage";

import { ACTIVE_NETWORK, isTestnetNetwork } from "@/constants/networks";

import { createOutflowGuard } from "@/core/security/outflowGuard";
import { freeQuarantineKey } from "@/core/storage/quarantineKey";
import {
  countUnvaluedOutflows,
  sumTrackedOutflowUsd,
} from "@/core/security/policyContext";

import { keyValueStorage, walletEngine } from "./compositionRoot";
import { trackedTransactionApi } from "./trackedTransactionApi";

const RESERVATION_KEY = "security.outflow-reservations.v1";

const RESERVATION_QUARANTINE_KEY = "security.outflow-reservations.v1.unreadable";

const dollarRulesApply = !isTestnetNetwork(ACTIVE_NETWORK.id);

const guard = createOutflowGuard({
  store: {
    read: () => keyValueStorage.get(RESERVATION_KEY),

    write: (value) => keyValueStorage.set(RESERVATION_KEY, value),
  },

  now: () => Date.now(),
});

export type OutflowHold =
  | {
      ok: true;

      id: string | null;
    }
  | {
      ok: false;

      message: string;
    };

function formatUsd(value: number) {
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

class UnvaluedOutflowError extends Error {
  constructor(count: number) {
    super(
      `${count} transfer${count === 1 ? "" : "s"} from the last day cannot be valued in dollars, so this wallet cannot prove this one stays inside your daily limit. Turn the daily limit off if you want to send it anyway.`,
    );

    this.name = "UnvaluedOutflowError";
  }
}

export const outflowGuardApi = {
  async reconcile() {
    return guard.reconcile();
  },

  async readable() {
    return guard.readable();
  },

  // Keeps the unreadable value rather than deleting it: it is the only record
  // of holds that were counted against today's limit. The copy is written
  // before the live ledger is replaced, and never over an earlier one.
  //
  // Parked in ordinary device storage, not the secure store: these are USD
  // amounts and hold ids, not secrets, and the secure store cannot list its
  // own keys — so copies left there could never be found again, and the
  // "no free place left" refusal would name an action nobody could take.
  async quarantine() {
    await guard.quarantine(async (raw) => {
      await AsyncStorage.setItem(
        await freeQuarantineKey(RESERVATION_QUARANTINE_KEY, (key) =>
          AsyncStorage.getItem(key),
        ),
        raw,
      );
    });
  },

  async keptCopies(): Promise<string[]> {
    const keys = await AsyncStorage.getAllKeys();

    return keys.filter(
      (key) =>
        key === RESERVATION_QUARANTINE_KEY ||
        key.startsWith(`${RESERVATION_QUARANTINE_KEY}.`),
    );
  },

  async forgetKeptCopies(): Promise<number> {
    const keys = await this.keptCopies();

    await AsyncStorage.multiRemove(keys);

    return keys.length;
  },

  async hold({
    id,
    amountUsd,
    limitUsd,
  }: {
    id: string;

    amountUsd: number | null;

    limitUsd: number | null;
  }): Promise<OutflowHold> {
    if (limitUsd === null || !dollarRulesApply) {
      return { ok: true, id: null };
    }

    if (amountUsd === null || !Number.isFinite(amountUsd) || amountUsd < 0) {
      return {
        ok: false,

        message:
          "This transfer cannot be valued, so it cannot be counted against your daily limit. Turn the daily limit off if you want to send it anyway.",
      };
    }

    const wallet = await walletEngine.getActive();

    if (!wallet) {
      throw new Error("Active wallet not found");
    }

    try {
      const result = await guard.checkAndReserve({
        id,

        amountUsd,

        limitUsd,

        spentTodayUsd: async () => {
          const tracked = await trackedTransactionApi.listAllForDevice();

          const unvalued = countUnvaluedOutflows({
            owner: wallet.address,
            tracked,
          });

          if (unvalued > 0) {
            throw new UnvaluedOutflowError(unvalued);
          }

          return sumTrackedOutflowUsd({
            owner: wallet.address,

            tracked,

            priceOf: () => null,
          });
        },
      });

      if (result.ok) {
        return { ok: true, id: result.reserved ? id : null };
      }

      if (result.reason === "over-daily-outflow") {
        return {
          ok: false,

          message: `This would bring today's outflow to ${formatUsd(
            result.wouldTotalUsd ?? 0,
          )}, counting transfers already waiting to be signed or confirmed. Your daily limit is ${formatUsd(
            result.limitUsd ?? 0,
          )}.`,
        };
      }

      return {
        ok: false,

        message:
          "Your daily limit could not be checked against the transfers already in flight, so this transfer was refused.",
      };
    } catch (error) {
      if (error instanceof UnvaluedOutflowError) {
        return { ok: false, message: error.message };
      }

      console.error("Outflow reservation failed:", error);

      return {
        ok: false,

        message:
          error instanceof Error
            ? error.message
            : "Your daily limit could not be checked, so this transfer was refused.",
      };
    }
  },

  async release(id: string | null) {
    if (id === null) {
      return;
    }

    try {
      await guard.release(id);
    } catch (error) {
      console.error("Releasing an outflow hold failed:", error);
    }
  },
};
