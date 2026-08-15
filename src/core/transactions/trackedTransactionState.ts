import type { TrackedTransaction } from "./trackedTransaction";

// Local outflow history is one of the two inputs the daily limit is computed
// from. An unreadable ledger is not a proven-empty ledger: reading it as `[]`
// resets today's spending to zero and hands back the whole limit.
export class TrackedTransactionStateError extends Error {
  constructor() {
    super(
      "This device's record of your recent transactions is unavailable: it cannot be read, so nothing can be sent. A transfer is written down before it is broadcast, and today's outflow is counted from that record. Open Settings and repair local records to continue.",
    );

    this.name = "TrackedTransactionStateError";
  }
}

const KNOWN_STATUSES = new Set([
  "broadcast-pending",
  "broadcast-unknown",
  "pending",
  "confirmed",
  "reverted",
  "superseded",
]);

const KNOWN_ASSET_TYPES = new Set(["native", "erc20", "swap", "approve"]);

// `valueWei` reaches `BigInt(...)` in policyContext.sumTrackedOutflowUsd, which
// runs outside any try/catch on the send path. A record that survives this
// check must not be able to throw there.
function isWeiString(value: unknown): boolean {
  return typeof value === "string" && /^\d+$/u.test(value);
}

function isOptionalWeiString(value: unknown): boolean {
  return value === undefined || value === null || isWeiString(value);
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || value === null || typeof value === "string";
}

// The same line calls `formatUnits(wei, tokenDecimals)`. viem rejects a
// negative value outright, and a very large one asks it to build a string of
// that length. `Number.isInteger` alone lets both through, and the resulting
// throw is not a TrackedTransactionStateError — so it never reaches the
// unreadable-record handling, and the repair screen reports the record as fine
// while nothing can be sent. ERC-20 decimals is a uint8.
const MAX_TOKEN_DECIMALS = 255;

function isTokenDecimals(value: unknown): boolean {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= MAX_TOKEN_DECIMALS
  );
}

// Validates exactly the fields the rest of the app dereferences without
// guarding. Anything looser lets a corrupt record crash a screen or drop out
// of daily accounting; anything stricter risks locking a user out of sending
// over a field nobody reads.
function isTrackedRecord(value: unknown): value is TrackedTransaction {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    record.version === 1 &&
    typeof record.hash === "string" &&
    /^0x[0-9a-fA-F]+$/u.test(record.hash) &&
    typeof record.chainId === "number" &&
    Number.isFinite(record.chainId) &&
    typeof record.walletId === "string" &&
    typeof record.from === "string" &&
    typeof record.to === "string" &&
    typeof record.symbol === "string" &&
    typeof record.assetType === "string" &&
    KNOWN_ASSET_TYPES.has(record.assetType) &&
    isWeiString(record.valueWei) &&
    // Never negative: a stored negative subtracts from today's counted
    // outflow and hands back limit that was already spent.
    (record.valueUsd === undefined ||
      record.valueUsd === null ||
      (typeof record.valueUsd === "number" &&
        Number.isFinite(record.valueUsd) &&
        record.valueUsd >= 0)) &&
    (record.tokenDecimals === undefined ||
      isTokenDecimals(record.tokenDecimals)) &&
    // The swap and receipt fields go through the same BigInt / formatUnits
    // pair in mergeActivity and getTransactionDetails. Leaving them unchecked
    // reproduces the tokenDecimals defect one screen over: the record passes
    // as readable, Activity throws a raw viem error, and the repair screen
    // reports that everything could be read.
    isOptionalWeiString(record.valueOutWei) &&
    isOptionalWeiString(record.minAmountOutWei) &&
    isOptionalWeiString(record.actualAmountOutWei) &&
    isOptionalWeiString(record.gasUsed) &&
    isOptionalWeiString(record.effectiveGasPriceWei) &&
    isOptionalWeiString(record.blockNumber) &&
    isOptionalWeiString(record.gasLimit) &&
    (record.tokenOutDecimals === undefined ||
      isTokenDecimals(record.tokenOutDecimals)) &&
    isOptionalString(record.symbolOut) &&
    isOptionalString(record.routeLabel) &&
    typeof record.createdAt === "number" &&
    Number.isFinite(record.createdAt) &&
    typeof record.status === "string" &&
    KNOWN_STATUSES.has(record.status) &&
    // "Confirmed" means the chain said so, and the chain always says it with a
    // block, the gas it burned and a time. A record claiming the word without
    // them is corrupt, not a confirmation this device happens to know less
    // about — and silently dropping it would quietly shrink the set of
    // recipients the lookalike detector compares against.
    (record.status !== "confirmed" ||
      (isWeiString(record.blockNumber) &&
        isWeiString(record.gasUsed) &&
        typeof record.confirmedAt === "number" &&
        Number.isFinite(record.confirmedAt)))
  );
}

export function parseTrackedTransactions(
  raw: string | null,
): TrackedTransaction[] {
  if (raw === null || raw.trim() === "") {
    return [];
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new TrackedTransactionStateError();
  }

  if (!Array.isArray(parsed) || !parsed.every(isTrackedRecord)) {
    throw new TrackedTransactionStateError();
  }

  return parsed;
}
