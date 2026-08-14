import {
  advanceFreeze,
  createFreeze,
  isFrozen,
  parseFreeze,
  remainingFreezeMs,
  serializeFreeze,
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

  const advanced = advanceFreeze(state, Date.now());

  if (advanced !== state) {
    await expoKeyValueStorage.set(FREEZE_KEY, serializeFreeze(advanced));
  }

  return advanced;
}

export const panicApi = {
  async status(): Promise<{ frozen: boolean; remainingMs: number }> {
    const state = await readFreeze();

    const now = Date.now();

    if (!isFrozen(state, now)) {
      if (state) {
        await expoKeyValueStorage.remove(FREEZE_KEY);
      }

      return { frozen: false, remainingMs: 0 };
    }

    return { frozen: true, remainingMs: remainingFreezeMs(state!, now) };
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
