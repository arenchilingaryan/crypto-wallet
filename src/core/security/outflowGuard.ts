import {
  parseReservations,
  releaseReservation,
  reserveOutflow,
  reservedTotalUsd,
  serializeReservations,
  RESERVATION_TTL_MS,
  type OutflowReservation,
} from "./outflowReservations";

export class ReservationStateError extends Error {
  constructor() {
    super(
      "This device's record of transfers already awaiting signature cannot be read, so your daily limit cannot be enforced. Open Settings and repair local records, or turn the daily limit off, before sending.",
    );

    this.name = "ReservationStateError";
  }
}

// Replacing a ledger that can be read discards holds this device knows about
// and hands the whole daily limit back. That is the fail-open this guard
// exists to prevent, so it is refused no matter who asks.
export class ReadableReservationsError extends Error {
  constructor() {
    super(
      "These holds can be read, so there is nothing to repair. Replacing them would hand back part of today's limit.",
    );

    this.name = "ReadableReservationsError";
  }
}

export type ReservationStore = {
  read(): Promise<string | null>;

  write(value: string): Promise<void>;
};

export type ReserveRequest = {
  id: string;

  amountUsd: number;

  limitUsd: number | null;

  spentTodayUsd: () => Promise<number>;
};

export type ReserveResult =
  | {
      ok: true;

      reserved: boolean;
    }
  | {
      ok: false;

      reason:
        | "over-daily-outflow"
        | "unusable-amount"
        | "unusable-context"
        | "duplicate-reservation";

      wouldTotalUsd: number | null;

      limitUsd: number | null;
    };

export type OutflowGuard = {
  checkAndReserve(request: ReserveRequest): Promise<ReserveResult>;

  release(id: string): Promise<void>;

  reconcile(): Promise<OutflowReservation[]>;

  reservedUsd(): Promise<number>;

  readable(): Promise<boolean>;

  // The explicit recovery action. Never called on its own: an unreadable
  // ledger keeps failing closed until the user chooses this, because the
  // discarded holds were counted against today's limit.
  //
  // `preserve` is handed the unreadable value and must finish before the live
  // ledger is replaced, so a crash in between cannot lose the only remaining
  // record of holds that were counted. A readable ledger is refused outright:
  // otherwise this is a button that resets the daily limit on demand.
  quarantine(preserve: (raw: string) => Promise<void>): Promise<void>;
};

export function createOutflowGuard({
  store,
  now,
  ttlMs = RESERVATION_TTL_MS,
}: {
  store: ReservationStore;

  now: () => number;

  ttlMs?: number;
}): OutflowGuard {
  let queue: Promise<unknown> = Promise.resolve();

  function serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = queue.then(operation, operation);

    queue = result.then(
      () => undefined,
      () => undefined,
    );

    return result;
  }

  async function readOrThrow(): Promise<OutflowReservation[]> {
    const state = parseReservations(await store.read());

    if (!state.readable) {
      throw new ReservationStateError();
    }

    return state.reservations;
  }

  return {
    checkAndReserve(request) {
      return serialize(async () => {
        if (request.limitUsd === null) {
          return { ok: true, reserved: false };
        }

        const stored = await readOrThrow();

        const spentTodayUsd = await request.spentTodayUsd();

        const outcome = reserveOutflow({
          reservations: stored,

          id: request.id,

          amountUsd: request.amountUsd,

          spentTodayUsd,

          limitUsd: request.limitUsd,

          now: now(),

          ttlMs,
        });

        if (!outcome.ok) {
          return {
            ok: false,

            reason: outcome.reason,

            wouldTotalUsd: outcome.wouldTotalUsd,

            limitUsd: outcome.limitUsd,
          };
        }

        await store.write(serializeReservations(outcome.reservations));

        return { ok: true, reserved: true };
      });
    },

    release(id) {
      return serialize(async () => {
        const next = releaseReservation(await readOrThrow(), id);

        await store.write(serializeReservations(next));
      });
    },

    reconcile() {
      return serialize(async () => {
        const current = now();

        const state = parseReservations(await store.read());

        if (!state.readable) {
          // Overwriting the unreadable ledger here would turn a fail-closed
          // state into a readable empty one: the throw is logged at startup,
          // and the very next reservation then sails through against a limit
          // it can no longer account for. Leave the state quarantined.
          throw new ReservationStateError();
        }

        const clamped = state.reservations.map((reservation) =>
          reservation.createdAt > current
            ? { ...reservation, createdAt: current }
            : reservation,
        );

        const live = clamped.filter(
          (reservation) => current - reservation.createdAt < ttlMs,
        );

        const changed =
          live.length !== state.reservations.length ||
          clamped.some(
            (reservation, index) =>
              reservation.createdAt !== state.reservations[index]?.createdAt,
          );

        if (changed) {
          await store.write(serializeReservations(live));
        }

        return live;
      });
    },

    reservedUsd() {
      return serialize(async () =>
        reservedTotalUsd(await readOrThrow(), now(), ttlMs),
      );
    },

    readable() {
      return serialize(async () => parseReservations(await store.read()).readable);
    },

    quarantine(preserve) {
      return serialize(async () => {
        const raw = await store.read();

        if (parseReservations(raw).readable) {
          throw new ReadableReservationsError();
        }

        // `raw` is non-null here: parseReservations reports null as readable.
        await preserve(raw as string);

        await store.write(serializeReservations([]));
      });
    },
  };
}
