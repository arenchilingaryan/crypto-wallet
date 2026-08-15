// Three rounds of review found the same defect one field further along: a
// stored string reaches `BigInt()` or `formatUnits()` without anyone checking
// it is a number, and the resulting throw is not the typed unreadable-record
// error, so it escapes every handler built for that case.
//
// The validator in trackedTransactionState is one half of the answer. This is
// the other: readers convert through here, so a field nobody thought to
// whitelist degrades to "unknown" instead of taking a screen down.

export function isDecimalString(value: unknown): value is string {
  return typeof value === "string" && /^\d+$/u.test(value);
}

export function toBigIntOrNull(value: unknown): bigint | null {
  return isDecimalString(value) ? BigInt(value) : null;
}
