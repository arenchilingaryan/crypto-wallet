import {
  UNKNOWN,
  type BalanceValue,
  type NumberValue,
  type TextValue,
  type TokenAmount,
  type TriState,
} from "@/core/token-intelligence/types";

import { normalizeProviderAddress } from "./address";

export type UnknownRecord = Record<string, unknown>;

export function asRecord(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

export function own(record: UnknownRecord, key: string): unknown {
  return Object.prototype.hasOwnProperty.call(record, key)
    ? record[key]
    : undefined;
}

export function parseTriState(value: unknown): TriState {
  if (value === true || value === "1" || value === 1) {
    return true;
  }

  if (value === false || value === "0" || value === 0) {
    return false;
  }

  return UNKNOWN;
}

export function parseText(value: unknown, maxLength = 1_000): TextValue {
  if (typeof value !== "string") {
    return UNKNOWN;
  }

  const text = value.trim();

  return text.length > 0 && text.length <= maxLength ? text : UNKNOWN;
}

export function parseAddressText(value: unknown): TextValue {
  return normalizeProviderAddress(value) ?? UNKNOWN;
}

export function parsePoolIdentifier(value: unknown): TextValue {
  const address = normalizeProviderAddress(value);

  if (address) {
    return address;
  }

  if (typeof value !== "string") {
    return UNKNOWN;
  }

  const identifier = value.trim();

  return /^0x[0-9a-fA-F]{64}$/.test(identifier)
    ? identifier.toLowerCase()
    : UNKNOWN;
}

export function parseOwnerAddress(value: unknown): TextValue {
  if (value === "") {
    return "none";
  }

  return parseAddressText(value);
}

export function parseNonnegativeNumber(
  value: unknown,
  maximum = Number.POSITIVE_INFINITY,
): NumberValue {
  if (value === null || value === undefined) {
    return UNKNOWN;
  }

  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" &&
          /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim())
        ? Number(value)
        : Number.NaN;

  return Number.isFinite(parsed) && parsed >= 0 && parsed <= maximum
    ? parsed
    : UNKNOWN;
}

export function parseSafeInteger(value: unknown): NumberValue {
  const parsed = parseNonnegativeNumber(value, Number.MAX_SAFE_INTEGER);

  return parsed !== UNKNOWN && Number.isSafeInteger(parsed) ? parsed : UNKNOWN;
}

export function parseGoPlusFractionAsPercent(value: unknown): NumberValue {
  const fraction = parseNonnegativeNumber(value, 1);

  return fraction === UNKNOWN ? UNKNOWN : fraction * 100;
}

export function parsePercentPoints(value: unknown): NumberValue {
  return parseNonnegativeNumber(value, 100);
}

export function parseRawInteger(
  value: unknown,
  decimals: TokenAmount["decimals"] = UNKNOWN,
): BalanceValue {
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    return UNKNOWN;
  }

  try {
    return {
      units: BigInt(value),
      decimals,
    };
  } catch {
    return UNKNOWN;
  }
}

export function parseIntegerNumber(value: unknown): NumberValue {
  const raw = parseRawInteger(
    typeof value === "number" && Number.isSafeInteger(value)
      ? String(value)
      : value,
  );

  if (raw === UNKNOWN || raw.units > BigInt(Number.MAX_SAFE_INTEGER)) {
    return UNKNOWN;
  }

  return Number(raw.units);
}

export function parseDecimalAmount(value: unknown): BalanceValue {
  if (typeof value !== "string") {
    return UNKNOWN;
  }

  const match = /^(0|[1-9]\d*)(?:\.(\d+))?$/.exec(value);

  if (!match) {
    return UNKNOWN;
  }

  const fraction = match[2] ?? "";

  try {
    return {
      units: BigInt(`${match[1]}${fraction}`),
      decimals: fraction.length,
    };
  } catch {
    return UNKNOWN;
  }
}

export function parseDecimalToUnits(
  value: unknown,
  decimals: number,
): BalanceValue {
  if (
    typeof value !== "string" ||
    !Number.isSafeInteger(decimals) ||
    decimals < 0 ||
    decimals > 255
  ) {
    return UNKNOWN;
  }

  const match = /^(0|[1-9]\d*)(?:\.(\d+))?$/.exec(value);

  if (!match) {
    return UNKNOWN;
  }

  const whole = match[1];

  const fraction = match[2] ?? "";

  if (fraction.length > decimals) {
    const discarded = fraction.slice(decimals);

    if (!/^0*$/.test(discarded)) {
      return UNKNOWN;
    }
  }

  const units = `${whole}${fraction.slice(0, decimals).padEnd(decimals, "0")}`;

  try {
    return {
      units: BigInt(units),
      decimals,
    };
  } catch {
    return UNKNOWN;
  }
}

export function parseGas(value: unknown): NumberValue {
  return parseIntegerNumber(value);
}

export function parseUnixSeconds(value: unknown): NumberValue {
  const seconds = parseNonnegativeNumber(value);

  if (seconds === UNKNOWN) {
    return UNKNOWN;
  }

  const milliseconds = seconds * 1_000;

  return Number.isSafeInteger(milliseconds) ? milliseconds : UNKNOWN;
}

export function parseDateTime(value: unknown): NumberValue {
  const numericTimestamp =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\d+$/.test(value.trim())
        ? Number(value)
        : null;

  if (numericTimestamp !== null) {
    if (!Number.isSafeInteger(numericTimestamp) || numericTimestamp < 0) {
      return UNKNOWN;
    }

    // Provider timestamps are conventionally Unix seconds (10 digits). Keep
    // already-millisecond timestamps intact if a provider returns one.
    const milliseconds =
      numericTimestamp < 100_000_000_000
        ? numericTimestamp * 1_000
        : numericTimestamp;

    return Number.isSafeInteger(milliseconds) ? milliseconds : UNKNOWN;
  }

  if (typeof value !== "string" || value.trim() === "") {
    return UNKNOWN;
  }

  const milliseconds = Date.parse(value);

  return Number.isFinite(milliseconds) && milliseconds >= 0
    ? milliseconds
    : UNKNOWN;
}

export function parseStringArray(value: unknown): readonly string[] {
  if (typeof value === "string") {
    const parsed = parseText(value);

    return parsed === UNKNOWN ? [] : [parsed];
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    const parsed = parseText(entry);

    return parsed === UNKNOWN ? [] : [parsed];
  });
}
