const DECIMAL_PATTERN = /^-?\d+(\.\d+)?$/;

export function isDecimalAmount(value: string): boolean {
  return DECIMAL_PATTERN.test(value.trim());
}

function split(value: string): { whole: string; fraction: string } {
  const [whole, fraction = ""] = value.trim().split(".");

  return { whole, fraction };
}

export function addDecimalAmounts(values: string[]): string | null {
  if (values.length === 0) {
    return null;
  }

  if (!values.every(isDecimalAmount)) {
    return null;
  }

  const scale = values.reduce(
    (widest, value) => Math.max(widest, split(value).fraction.length),
    0,
  );

  let total = 0n;

  for (const value of values) {
    const { whole, fraction } = split(value);

    total += BigInt(`${whole}${fraction.padEnd(scale, "0")}`);
  }

  if (total === 0n) {
    return "0";
  }

  if (scale === 0) {
    return total.toString();
  }

  const negative = total < 0n;

  const digits = (negative ? -total : total).toString().padStart(scale + 1, "0");

  const whole = digits.slice(0, digits.length - scale);

  const fraction = digits.slice(digits.length - scale).replace(/0+$/, "");

  const result = fraction ? `${whole}.${fraction}` : whole;

  return negative ? `-${result}` : result;
}

export function isPositiveAmount(value: string): boolean {
  if (!isDecimalAmount(value)) {
    return false;
  }

  return /[1-9]/.test(value.replace("-", "")) && !value.trim().startsWith("-");
}
