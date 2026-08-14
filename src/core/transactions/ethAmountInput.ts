import { parseEther } from "viem";

export function normalizeEthAmountInput(input: string): string | null {
  let value = input.trim().replace(",", ".");

  if (value === ".") {
    return "0.";
  }

  if (value.startsWith(".")) {
    value = `0${value}`;
  }

  if (!/^\d*(?:\.\d{0,18})?$/.test(value)) {
    return null;
  }

  return value;
}

export function parseEthAmountInput(value: string): bigint | null {
  if (!value || value === "." || value.endsWith(".")) {
    return null;
  }

  try {
    const parsed = parseEther(value);

    return parsed > 0n ? parsed : null;
  } catch {
    return null;
  }
}
