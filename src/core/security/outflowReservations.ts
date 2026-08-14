export const RESERVATION_TTL_MS = 10 * 60 * 1000;

export type OutflowReservation = {
  id: string;

  amountUsd: number;

  createdAt: number;
};

export type ReservationState =
  | {
      readable: true;

      reservations: OutflowReservation[];
    }
  | {
      readable: false;
    };

export type ReservationOutcome =
  | {
      ok: true;

      reservations: OutflowReservation[];
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

export function isUsableMoney(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isReservation(entry: unknown): entry is OutflowReservation {
  if (typeof entry !== "object" || entry === null) {
    return false;
  }

  const candidate = entry as Partial<OutflowReservation>;

  return (
    typeof candidate.id === "string" &&
    candidate.id.length > 0 &&
    isUsableMoney(candidate.amountUsd) &&
    typeof candidate.createdAt === "number" &&
    Number.isFinite(candidate.createdAt)
  );
}

export function parseReservations(raw: string | null): ReservationState {
  if (raw === null || raw.trim() === "") {
    return { readable: true, reservations: [] };
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return { readable: false };
  }

  if (!Array.isArray(parsed)) {
    return { readable: false };
  }

  if (!parsed.every(isReservation)) {
    return { readable: false };
  }

  return { readable: true, reservations: parsed };
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
  return reservations.filter((reservation) => {
    const age = now - reservation.createdAt;

    return age < ttlMs;
  });
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
  if (!isUsableMoney(amountUsd)) {
    return {
      ok: false,
      reason: "unusable-amount",
      wouldTotalUsd: null,
      limitUsd: isUsableMoney(limitUsd) ? limitUsd : null,
    };
  }

  if (!isUsableMoney(spentTodayUsd) || !isUsableMoney(limitUsd)) {
    return {
      ok: false,
      reason: "unusable-context",
      wouldTotalUsd: null,
      limitUsd: isUsableMoney(limitUsd) ? limitUsd : null,
    };
  }

  if (typeof id !== "string" || id.length === 0) {
    return {
      ok: false,
      reason: "duplicate-reservation",
      wouldTotalUsd: null,
      limitUsd,
    };
  }

  if (reservations.some((reservation) => reservation.id === id)) {
    return {
      ok: false,
      reason: "duplicate-reservation",
      wouldTotalUsd: null,
      limitUsd,
    };
  }

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
