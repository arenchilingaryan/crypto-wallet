import {
  UNKNOWN,
  type Evidence,
  type EvidenceConflict,
  type EvidenceObservation,
  type KnownOrUnknown,
  type ProviderId,
} from "./types";
import { amountToDecimalString } from "./validation";

type EvidenceOptions<T> = {
  preferredSources?: readonly ProviderId[];
  conservative?: (values: readonly T[]) => KnownOrUnknown<T>;
};

function equal<T>(left: T, right: T) {
  return Object.is(left, right);
}

export function unknownEvidence<T>(): Evidence<T> {
  return {
    value: UNKNOWN,
    observations: [],
    conflict: false,
    resolution: "none",
  };
}

export function resolveEvidence<T>(
  observations: readonly EvidenceObservation<T>[],
  options: EvidenceOptions<T> = {},
): Evidence<T> {
  const known = observations.filter(
    (item): item is EvidenceObservation<T> & { value: T } =>
      item.value !== UNKNOWN,
  );

  if (known.length === 0) {
    return {
      ...unknownEvidence<T>(),
      observations,
    };
  }

  const first = known[0].value;
  const conflict = known.some((item) => !equal(item.value, first));

  if (!conflict) {
    return {
      value: first,
      observations,
      conflict: false,
      resolution: known.length === 1 ? "single-source" : "consensus",
    };
  }

  const conservative = options.conservative?.(known.map((item) => item.value));

  if (conservative !== undefined && conservative !== UNKNOWN) {
    return {
      value: conservative,
      observations,
      conflict: true,
      resolution: "conservative",
    };
  }

  for (const source of options.preferredSources ?? []) {
    const preferred = known.find((item) => item.source === source);

    if (preferred) {
      return {
        value: preferred.value,
        observations,
        conflict: true,
        resolution: "preferred-source",
      };
    }
  }

  return {
    value: UNKNOWN,
    observations,
    conflict: true,
    resolution: "unresolved-conflict",
  };
}

export function evidenceSources<T>(evidence: Evidence<T>): ProviderId[] {
  return [
    ...new Set(
      evidence.observations
        .filter((item) => item.value !== UNKNOWN)
        .map((item) => item.source),
    ),
  ];
}

function displayValue(value: unknown): string {
  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "string" || typeof value === "boolean") {
    return String(value);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (
    value !== null &&
    typeof value === "object" &&
    "units" in value &&
    typeof value.units === "bigint" &&
    "decimals" in value &&
    (value.decimals === UNKNOWN ||
      (typeof value.decimals === "number" &&
        Number.isSafeInteger(value.decimals)))
  ) {
    const tokenAmount = {
      units: value.units,
      decimals: value.decimals,
    } as const;
    const amount = amountToDecimalString(tokenAmount);

    return amount === UNKNOWN
      ? `${tokenAmount.units.toString()} raw units`
      : amount;
  }

  return UNKNOWN;
}

export function evidenceConflict<T>(
  fact: string,
  evidence: Evidence<T>,
): EvidenceConflict | null {
  if (!evidence.conflict) {
    return null;
  }

  return {
    fact,
    observations: evidence.observations.map((item) => ({
      source: item.source,
      value: displayValue(item.value),
      observedAt: item.observedAt,
    })),
  };
}
