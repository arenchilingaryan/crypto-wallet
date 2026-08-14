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
      "The record of transfers already awaiting signature cannot be read, so your daily limit cannot be enforced. Unlock the app again, or clear the wallet limits, before sending.",
    );

    this.name = "ReservationStateError";
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
          await store.write(serializeReservations([]));

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
  };
}
