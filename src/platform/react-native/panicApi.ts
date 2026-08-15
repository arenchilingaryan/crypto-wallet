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
    try {
      await expoKeyValueStorage.set(FREEZE_KEY, serializeFreeze(advanced));
    } catch (error) {
      // The clamp is an optimisation; the value in hand is still correct for
      // this call, and failing the read would hide the unlock controls.
      console.error("Advancing the lockdown record failed:", error);
    }
  }

  return advanced;
}

// Lifting a lockdown must not depend on the store accepting a delete. If it
// refuses, write a record that is already over instead: it parses, it reads as
// not frozen, and signing is usable again. Only when the store refuses both
// does this fail — and then it says so rather than leaving a wallet that
// cannot sign and cannot show its own recovery phrase.
async function clearLockdown(): Promise<void> {
  try {
    await expoKeyValueStorage.remove(FREEZE_KEY);

    return;
  } catch (error) {
    console.error("Removing the lockdown record failed:", error);
  }

  await expoKeyValueStorage.set(
    FREEZE_KEY,
    serializeFreeze({
      version: 1,
      frozenAt: 0,
      until: 0,
      seen: 0,
      unfreezeRequestedAt: null,
    }),
  );
}

export const panicApi = {
  async status(): Promise<{
    frozen: boolean;

    // False when the lockdown record itself cannot be read. Signing stays
    // refused — that is the safe direction — but the screen has to render the
    // way out, or the wallet is bricked by a corrupt file with no button on
    // it. This method therefore never throws.
    readable: boolean;

    remainingMs: number;

    unfreezeRequested: boolean;

    unfreezeReadyInMs: number;
  }> {
    let state: FreezeState | null;

    try {
      state = await readFreeze();
    } catch {
      return {
        frozen: true,
        readable: false,
        remainingMs: 0,
        unfreezeRequested: true,
        unfreezeReadyInMs: 0,
      };
    }

    const now = Date.now();

    if (!isFrozen(state, now)) {
      if (state) {
        try {
          // Tidying up an expired record. If the store refuses the delete, the
          // lockdown is still over — throwing here would take the whole screen
          // down and hide the controls, which is the failure this method
          // exists to avoid.
          await expoKeyValueStorage.remove(FREEZE_KEY);
        } catch (error) {
          console.error("Clearing an expired lockdown failed:", error);
        }
      }

      return {
        frozen: false,
        readable: true,
        remainingMs: 0,
        unfreezeRequested: false,
        unfreezeReadyInMs: 0,
      };
    }

    const frozenState = state!;

    const readyIn = unfreezeReadyInMs(frozenState, now);

    return {
      frozen: true,

      readable: true,

      remainingMs: remainingFreezeMs(frozenState, now),

      unfreezeRequested: Number.isFinite(readyIn),

      unfreezeReadyInMs: Number.isFinite(readyIn) ? readyIn : 0,
    };
  },

  async requestUnfreeze(): Promise<void> {
    let state: FreezeState | null;

    try {
      state = await readFreeze();
    } catch {
      // Nothing to schedule against, but the request must not fail: it is the
      // first half of the only way out of an unreadable lockdown.
      return;
    }

    const now = Date.now();

    if (!isFrozen(state, now)) {
      return;
    }

    await expoKeyValueStorage.set(
      FREEZE_KEY,
      serializeFreeze(requestUnfreeze(state!, now)),
    );
  },

  // Whether the lockdown record can even be read. An unreadable one keeps
  // signing refused, which is the safe direction — but it must be visible, and
  // it must be liftable, or the wallet is bricked by a corrupt file.
  async readable(): Promise<boolean> {
    try {
      await readFreeze();

      return true;
    } catch {
      return false;
    }
  },

  async completeUnfreeze(): Promise<
    { ok: true } | { ok: false; readyInMs: number }
  > {
    let state: FreezeState | null;

    try {
      state = await readFreeze();
    } catch {
      // The record cannot be read, so no cooldown can be computed from it.
      // Lifting still costs a PIN, a wait and a second PIN — the controls that
      // make this safe are in the flow, not in the file. Refusing here would
      // leave signing permanently disabled with no way back.
      await clearLockdown();

      return { ok: true };
    }

    const now = Date.now();

    if (!isFrozen(state, now)) {
      await clearLockdown();

      return { ok: true };
    }

    if (!canUnfreezeNow(state!, now)) {
      return { ok: false, readyInMs: unfreezeReadyInMs(state!, now) };
    }

    await clearLockdown();

    return { ok: true };
  },

  async freeze(): Promise<void> {
    let existing: FreezeState | null;

    try {
      existing = await readFreeze();
    } catch {
      // Already refusing to sign; nothing to add.
      return;
    }

    const now = Date.now();

    if (isFrozen(existing, now)) {
      return;
    }

    // Deliberately not swallowed: a lockdown the user asked for and did not
    // get is the one failure they must hear about. The caller reports it.
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
