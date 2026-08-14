export const RESERVATION_TTL_MS = 10 * 60 * 1000;

export type OutflowReservation = {
  id: string;

  amountUsd: number;

  createdAt: number;
};

export type ReservationOutcome =
  | {
      ok: true;

      reservations: OutflowReservation[];
    }
  | {
      ok: false;

      reason: "over-daily-outflow";

      wouldTotalUsd: number;

      limitUsd: number;
    };

export function parseReservations(raw: string | null): OutflowReservation[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((entry): entry is OutflowReservation => {
      if (typeof entry !== "object" || entry === null) {
        return false;
      }

      const candidate = entry as Partial<OutflowReservation>;

      return (
        typeof candidate.id === "string" &&
        typeof candidate.amountUsd === "number" &&
        Number.isFinite(candidate.amountUsd) &&
        candidate.amountUsd >= 0 &&
        typeof candidate.createdAt === "number" &&
        Number.isFinite(candidate.createdAt)
      );
    });
  } catch {
    return [];
  }
}

export function serializeReservations(
  reservations: OutflowReservation[],
): string {
  return JSON.stringify(reservations);
}

export function liveReservations(
  reservations: OutflowReservation[],
  now: number,
  ttlMs: number = RESERVATION_TTL_MS,
): OutflowReservation[] {
  return reservations.filter(
    (reservation) => now - reservation.createdAt < ttlMs,
  );
}

export function reservedTotalUsd(
  reservations: OutflowReservation[],
  now: number,
  ttlMs: number = RESERVATION_TTL_MS,
): number {
  return liveReservations(reservations, now, ttlMs).reduce(
    (total, reservation) => total + reservation.amountUsd,
    0,
  );
}

export function reserveOutflow({
  reservations,
  id,
  amountUsd,
  spentTodayUsd,
  limitUsd,
  now,
  ttlMs = RESERVATION_TTL_MS,
}: {
  reservations: OutflowReservation[];

  id: string;

  amountUsd: number;

  spentTodayUsd: number;

  limitUsd: number;

  now: number;

  ttlMs?: number;
}): ReservationOutcome {
  const live = liveReservations(reservations, now, ttlMs);

  const wouldTotalUsd =
    spentTodayUsd + reservedTotalUsd(live, now, ttlMs) + amountUsd;

  if (wouldTotalUsd > limitUsd) {
    return {
      ok: false,

      reason: "over-daily-outflow",

      wouldTotalUsd,

      limitUsd,
    };
  }

  return {
    ok: true,

    reservations: [...live, { id, amountUsd, createdAt: now }],
  };
}

export function releaseReservation(
  reservations: OutflowReservation[],
  id: string,
): OutflowReservation[] {
  return reservations.filter((reservation) => reservation.id !== id);
}
