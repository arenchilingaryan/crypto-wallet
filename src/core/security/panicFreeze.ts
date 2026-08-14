export const FREEZE_DURATION_MS = 24 * 60 * 60 * 1000;

export const UNFREEZE_COOLDOWN_MS = 10 * 60 * 1000;

export type FreezeState = {
  version: 1;

  frozenAt: number;

  until: number;

  seen: number;

  unfreezeRequestedAt?: number | null;
};

export class WalletFrozenError extends Error {
  readonly remainingMs: number;

  constructor(remainingMs: number) {
    super(
      `This wallet is locked down and cannot sign anything for another ${describeRemaining(
        remainingMs,
      )}. You can start an early unlock from the Security screen; it takes a cooldown and your PIN twice.`,
    );

    this.name = "WalletFrozenError";

    this.remainingMs = remainingMs;
  }
}

export function describeRemaining(remainingMs: number): string {
  const minutes = Math.ceil(remainingMs / 60_000);

  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  }

  const hours = Math.ceil(minutes / 60);

  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

export function createFreeze(
  now: number,
  durationMs: number = FREEZE_DURATION_MS,
): FreezeState {
  return {
    version: 1,

    frozenAt: now,

    until: now + durationMs,

    seen: now,
  };
}

export function advanceFreeze(state: FreezeState, now: number): FreezeState {
  return now > state.seen ? { ...state, seen: now } : state;
}

export function requestUnfreeze(state: FreezeState, now: number): FreezeState {
  const advanced = advanceFreeze(state, now);

  if (
    typeof advanced.unfreezeRequestedAt === "number" &&
    advanced.unfreezeRequestedAt <= advanced.seen
  ) {
    return advanced;
  }

  return { ...advanced, unfreezeRequestedAt: advanced.seen };
}

export function unfreezeReadyInMs(state: FreezeState, now: number): number {
  const requestedAt = state.unfreezeRequestedAt;

  if (typeof requestedAt !== "number" || !Number.isFinite(requestedAt)) {
    return Number.POSITIVE_INFINITY;
  }

  const clock = Math.max(now, state.seen);

  return Math.max(0, requestedAt + UNFREEZE_COOLDOWN_MS - clock);
}

export function canUnfreezeNow(state: FreezeState, now: number): boolean {
  return unfreezeReadyInMs(state, now) === 0;
}

export function remainingFreezeMs(state: FreezeState, now: number): number {
  const clock = Math.max(now, state.seen);

  return Math.max(0, state.until - clock);
}

export function isFrozen(state: FreezeState | null, now: number): boolean {
  return state !== null && remainingFreezeMs(state, now) > 0;
}

export function serializeFreeze(state: FreezeState): string {
  return JSON.stringify(state);
}

export class FreezeStateUnreadableError extends Error {
  constructor() {
    super(
      "This device has a lockdown record that cannot be read, so signing stays blocked. Restore this wallet from its recovery phrase if this does not clear.",
    );

    this.name = "FreezeStateUnreadableError";
  }
}

export function parseFreeze(raw: string | null): FreezeState | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<FreezeState>;

    if (
      parsed.version !== 1 ||
      typeof parsed.frozenAt !== "number" ||
      typeof parsed.until !== "number" ||
      typeof parsed.seen !== "number" ||
      !Number.isFinite(parsed.frozenAt) ||
      !Number.isFinite(parsed.until) ||
      !Number.isFinite(parsed.seen) ||
      parsed.until < parsed.frozenAt
    ) {
      throw new FreezeStateUnreadableError();
    }

    return {
      version: 1,
      frozenAt: parsed.frozenAt,
      until: parsed.until,
      seen: parsed.seen,
      unfreezeRequestedAt:
        typeof parsed.unfreezeRequestedAt === "number" &&
        Number.isFinite(parsed.unfreezeRequestedAt)
          ? parsed.unfreezeRequestedAt
          : null,
    };
  } catch (error) {
    if (error instanceof FreezeStateUnreadableError) {
      throw error;
    }

    throw new FreezeStateUnreadableError();
  }
}
