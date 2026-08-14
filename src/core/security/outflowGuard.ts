import {
  parseReservations,
  releaseReservation,
  reserveOutflow,
  reservedTotalUsd,
  serializeReservations,
  RESERVATION_TTL_MS,
  type OutflowReservation,
} from "./outflowReservations";

export type ReservationStore = {
  read(): Promise<string | null>;

  write(value: string): Promise<void>;
};

export type ReserveRequest = {
  id: string;

  amountUsd: number;

  limitUsd: number | null;

  spentTodayUsd: number;
};

export type ReserveResult =
  | {
      ok: true;

      reserved: boolean;
    }
  | {
      ok: false;

      wouldTotalUsd: number;

      limitUsd: number;
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

  async function readAll(): Promise<OutflowReservation[]> {
    return parseReservations(await store.read());
  }

  return {
    checkAndReserve(request) {
      return serialize(async () => {
        if (request.limitUsd === null) {
          return { ok: true, reserved: false };
        }

        const current = now();

        const outcome = reserveOutflow({
          reservations: await readAll(),

          id: request.id,

          amountUsd: request.amountUsd,

          spentTodayUsd: request.spentTodayUsd,

          limitUsd: request.limitUsd,

          now: current,

          ttlMs,
        });

        if (!outcome.ok) {
          return {
            ok: false,

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
        const next = releaseReservation(await readAll(), id);

        await store.write(serializeReservations(next));
      });
    },

    reconcile() {
      return serialize(async () => {
        const current = now();

        const stored = await readAll();

        const live = stored.filter(
          (reservation) => current - reservation.createdAt < ttlMs,
        );

        if (live.length !== stored.length) {
          await store.write(serializeReservations(live));
        }

        return live;
      });
    },

    reservedUsd() {
      return serialize(async () =>
        reservedTotalUsd(await readAll(), now(), ttlMs),
      );
    },
  };
}
