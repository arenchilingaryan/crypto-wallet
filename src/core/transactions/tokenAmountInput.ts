import { parseUnits } from "viem";

export function normalizeTokenAmountInput(
  input: string,
  decimals: number,
): string | null {
  let value = input.trim().replace(",", ".");

  if (value === ".") {
    return "0.";
  }

  if (value.startsWith(".")) {
    value = `0${value}`;
  }

  const pattern =
    decimals > 0
      ? new RegExp(`^\\d*(?:\\.\\d{0,${decimals}})?$`)
      : /^\d*$/;

  if (!pattern.test(value)) {
    return null;
  }

  return value;
}

export function parseTokenAmountInput(
  value: string,
  decimals: number,
): bigint | null {
  if (!value || value === "." || value.endsWith(".")) {
    return null;
  }

  try {
    const parsed = parseUnits(value, decimals);

    return parsed > 0n ? parsed : null;
  } catch {
    return null;
  }
}
