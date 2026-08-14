import { ACTIVE_NETWORK, isTestnetNetwork } from "@/constants/networks";

import { createOutflowGuard } from "@/core/security/outflowGuard";
import { sumTrackedOutflowUsd } from "@/core/security/policyContext";

const dollarRulesApply = !isTestnetNetwork(ACTIVE_NETWORK.id);

import { keyValueStorage, walletEngine } from "./compositionRoot";
import { trackedTransactionApi } from "./trackedTransactionApi";

const RESERVATION_KEY = "security.outflow-reservations.v1";

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

export const outflowGuardApi = {
  async reconcile() {
    return guard.reconcile();
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
    if (limitUsd === null || dollarRulesApply === false) {
      return { ok: true, id: null };
    }

    if (amountUsd === null || !Number.isFinite(amountUsd)) {
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

    const tracked = await trackedTransactionApi.listAllForDevice();

    const spentTodayUsd = sumTrackedOutflowUsd({
      owner: wallet.address,

      tracked,

      priceOf: () => null,
    });

    const result = await guard.checkAndReserve({
      id,

      amountUsd,

      limitUsd,

      spentTodayUsd,
    });

    if (result.ok) {
      return { ok: true, id: result.reserved ? id : null };
    }

    return {
      ok: false,

      message: `This would bring today's outflow to ${formatUsd(
        result.wouldTotalUsd,
      )}, counting transfers already waiting to be signed or confirmed. Your daily limit is ${formatUsd(
        result.limitUsd,
      )}.`,
    };
  },

  async release(id: string | null) {
    if (id === null) {
      return;
    }

    await guard.release(id);
  },
};
