import {
  advanceFreeze,
  canUnfreezeNow,
  createFreeze,
  FreezeStateUnreadableError,
  isFrozen,
  parseFreeze,
  remainingFreezeMs,
  requestUnfreeze,
  serializeFreeze,
  unfreezeReadyInMs,
  WalletFrozenError,
  type FreezeState,
} from "@/core/security/panicFreeze";

import { expoKeyValueStorage } from "./keyValueStorage";

const FREEZE_KEY = "security.panic-freeze.v1";

async function readFreeze(): Promise<FreezeState | null> {
  const state = parseFreeze(await expoKeyValueStorage.get(FREEZE_KEY));

  if (!state) {
    return null;
  }

  if (state.until < state.frozenAt) {
    throw new FreezeStateUnreadableError();
  }

  const advanced = advanceFreeze(state, Date.now());

  if (advanced !== state) {
    await expoKeyValueStorage.set(FREEZE_KEY, serializeFreeze(advanced));
  }

  return advanced;
}

export const panicApi = {
  async status(): Promise<{
    frozen: boolean;

    remainingMs: number;

    unfreezeRequested: boolean;

    unfreezeReadyInMs: number;
  }> {
    const state = await readFreeze();

    const now = Date.now();

    if (!isFrozen(state, now)) {
      if (state) {
        await expoKeyValueStorage.remove(FREEZE_KEY);
      }

      return {
        frozen: false,
        remainingMs: 0,
        unfreezeRequested: false,
        unfreezeReadyInMs: 0,
      };
    }

    const frozenState = state!;

    const readyIn = unfreezeReadyInMs(frozenState, now);

    return {
      frozen: true,

      remainingMs: remainingFreezeMs(frozenState, now),

      unfreezeRequested: Number.isFinite(readyIn),

      unfreezeReadyInMs: Number.isFinite(readyIn) ? readyIn : 0,
    };
  },

  async requestUnfreeze(): Promise<void> {
    const state = await readFreeze();

    const now = Date.now();

    if (!isFrozen(state, now)) {
      return;
    }

    await expoKeyValueStorage.set(
      FREEZE_KEY,
      serializeFreeze(requestUnfreeze(state!, now)),
    );
  },

  async completeUnfreeze(): Promise<
    { ok: true } | { ok: false; readyInMs: number }
  > {
    const state = await readFreeze();

    const now = Date.now();

    if (!isFrozen(state, now)) {
      await expoKeyValueStorage.remove(FREEZE_KEY);

      return { ok: true };
    }

    if (!canUnfreezeNow(state!, now)) {
      return { ok: false, readyInMs: unfreezeReadyInMs(state!, now) };
    }

    await expoKeyValueStorage.remove(FREEZE_KEY);

    return { ok: true };
  },

  async freeze(): Promise<void> {
    const existing = await readFreeze();

    const now = Date.now();

    if (isFrozen(existing, now)) {
      return;
    }

    await expoKeyValueStorage.set(
      FREEZE_KEY,
      serializeFreeze(createFreeze(now)),
    );
  },

  async assertNotFrozen(): Promise<void> {
    const { frozen, remainingMs } = await this.status();

    if (frozen) {
      throw new WalletFrozenError(remainingMs);
    }
  },
};
