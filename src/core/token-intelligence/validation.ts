import {
  UNKNOWN,
  type BalanceValue,
  type KnownOrUnknown,
  type NumberValue,
  type TextValue,
  type TokenAmount,
  type TriState,
} from "./types";

const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;

export function asTriState(value: unknown): TriState {
  return value === true || value === false ? value : UNKNOWN;
}

export function asNonNegativeNumber(value: unknown): NumberValue {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : UNKNOWN;
}

export function asTimestamp(value: unknown): NumberValue {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : UNKNOWN;
}

export function asPercent(value: unknown): NumberValue {
  const number = asNonNegativeNumber(value);

  return number !== UNKNOWN && number <= 100 ? number : UNKNOWN;
}

export function asCount(value: unknown): NumberValue {
  const number = asNonNegativeNumber(value);

  return number !== UNKNOWN && Number.isSafeInteger(number) ? number : UNKNOWN;
}

export function asBalance(value: unknown): BalanceValue {
  if (!value || typeof value !== "object") {
    return UNKNOWN;
  }

  const candidate = value as Partial<TokenAmount>;
  const decimals = candidate.decimals;

  if (
    typeof candidate.units !== "bigint" ||
    candidate.units < 0n ||
    !(
      decimals === UNKNOWN ||
      (typeof decimals === "number" &&
        Number.isSafeInteger(decimals) &&
        decimals >= 0 &&
        decimals <= 255)
    )
  ) {
    return UNKNOWN;
  }

  return {
    units: candidate.units,
    decimals,
  };
}

export function asText(value: unknown): TextValue {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : UNKNOWN;
}

export function normalizeAddress(value: unknown): TextValue {
  return typeof value === "string" && ADDRESS_PATTERN.test(value.trim())
    ? value.trim().toLowerCase()
    : UNKNOWN;
}

export function percentOf(
  partValue: unknown,
  totalValue: unknown,
): NumberValue {
  const part = asBalance(partValue);
  const total = asBalance(totalValue);

  if (part === UNKNOWN || total === UNKNOWN) {
    return UNKNOWN;
  }

  const aligned = alignAmounts(part, total);

  if (!aligned || aligned.total === 0n || aligned.part > aligned.total) {
    return UNKNOWN;
  }

  const precision = 1_000_000n;
  const scaled = (aligned.part * 100n * precision) / aligned.total;
  const percent = Number(scaled) / Number(precision);

  return asPercent(percent);
}

export function subtractBalance(
  rawValue: BalanceValue,
  lockedValue: BalanceValue,
): BalanceValue {
  if (rawValue === UNKNOWN || lockedValue === UNKNOWN) {
    return UNKNOWN;
  }

  const aligned = alignAmounts(rawValue, lockedValue);

  if (!aligned || aligned.total > aligned.part) {
    return UNKNOWN;
  }

  return {
    units: aligned.part - aligned.total,
    decimals: aligned.decimals,
  };
}

function alignAmounts(
  part: TokenAmount,
  total: TokenAmount,
): { part: bigint; total: bigint; decimals: NumberValue } | null {
  if (part.decimals === UNKNOWN || total.decimals === UNKNOWN) {
    if (part.decimals !== total.decimals) {
      return null;
    }

    return {
      part: part.units,
      total: total.units,
      decimals: UNKNOWN,
    };
  }

  const decimals = Math.max(part.decimals, total.decimals);

  return {
    part: part.units * 10n ** BigInt(decimals - part.decimals),
    total: total.units * 10n ** BigInt(decimals - total.decimals),
    decimals,
  };
}

export function addBalances(values: readonly BalanceValue[]): BalanceValue {
  const known = values.filter((value): value is TokenAmount => value !== UNKNOWN);

  if (known.length !== values.length || known.length === 0) {
    return UNKNOWN;
  }

  let result = known[0];

  for (const value of known.slice(1)) {
    const aligned = alignAmounts(result, value);

    if (!aligned) {
      return UNKNOWN;
    }

    result = {
      units: aligned.part + aligned.total,
      decimals: aligned.decimals,
    };
  }

  return result;
}

export function amountToDecimalString(value: BalanceValue): TextValue {
  const amount = asBalance(value);

  if (amount === UNKNOWN || amount.decimals === UNKNOWN) {
    return UNKNOWN;
  }

  if (amount.decimals === 0) {
    return amount.units.toString();
  }

  const padded = amount.units.toString().padStart(amount.decimals + 1, "0");
  const whole = padded.slice(0, -amount.decimals);
  const fraction = padded.slice(-amount.decimals).replace(/0+$/, "");

  return fraction ? `${whole}.${fraction}` : whole;
}

export function isKnown<T>(value: KnownOrUnknown<T>): value is T {
  return value !== UNKNOWN;
}

export function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}
