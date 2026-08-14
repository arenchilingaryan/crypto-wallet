import { isAddress, type Address } from "viem";

// Event-log discovery for the Permission Graph.
//
// The permission scan can only be honest about "which contracts can already
// move my tokens" if it finds spenders it was never told about. A hardcoded
// allowlist answers a different, narrower question. This module turns the
// wallet's own `Approval` history into a candidate set of (token, spender)
// pairs; the *truth* about each candidate is always the current on-chain
// `allowance(owner, spender)`, resolved elsewhere. Events only discover;
// allowances decide.

export type ScanRange = { fromBlock: bigint; toBlock: bigint };

export type Coverage = "complete" | "partial";

export type SpenderPair = { token: Address; spender: Address };

export type ApprovalLogRecord = { token: Address; spender: Address };

export type ChunkOutcome = { range: ScanRange; ok: boolean };

const STATE_VERSION = 1;

export type DiscoveryState = {
  lastScannedBlock: bigint | null;

  pairs: SpenderPair[];
};

export function pairKey(pair: SpenderPair): string {
  return `${pair.token.toLowerCase()}|${pair.spender.toLowerCase()}`;
}

function normalizePair(token: string, spender: string): SpenderPair | null {
  if (
    !isAddress(token, { strict: false }) ||
    !isAddress(spender, { strict: false })
  ) {
    return null;
  }

  return {
    token: token.toLowerCase() as Address,

    spender: spender.toLowerCase() as Address,
  };
}

// Dedupe discovered records into unique candidate pairs. A spender approved by
// the same owner on the same token many times is one permission, not many.
export function extractCandidatePairs(
  records: ApprovalLogRecord[],
): SpenderPair[] {
  const seen = new Set<string>();

  const out: SpenderPair[] = [];

  for (const record of records) {
    const pair = normalizePair(record.token, record.spender);

    if (!pair) {
      continue;
    }

    const key = pairKey(pair);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    out.push(pair);
  }

  return out;
}

// Union of any number of pair groups, deduped. Used to fold freshly discovered
// pairs into the persisted set and to bootstrap with the known-spender list.
export function mergePairs(...groups: SpenderPair[][]): SpenderPair[] {
  const seen = new Set<string>();

  const out: SpenderPair[] = [];

  for (const group of groups) {
    for (const raw of group) {
      const pair = normalizePair(raw.token, raw.spender);

      if (!pair) {
        continue;
      }

      const key = pairKey(pair);

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);

      out.push(pair);
    }
  }

  return out;
}

// A token contract emits its own `Approval` events, so a hostile one can forge
// any number of (its token, arbitrary spender) pairs for this owner and try to
// flood discovery — bloating storage and the allowance multicall. Bound both
// the spenders tracked per token and the total. A single legitimate token
// almost never has more than a handful of live spenders, so the per-token cap
// bites spam without dropping real permissions spread across many tokens.
export const MAX_SPENDERS_PER_TOKEN = 20;

export const MAX_TRACKED_PAIRS = 500;

export function capPairs(pairs: SpenderPair[]): {
  pairs: SpenderPair[];

  truncated: boolean;
} {
  const perToken = new Map<string, number>();

  const out: SpenderPair[] = [];

  let truncated = false;

  for (const pair of pairs) {
    if (out.length >= MAX_TRACKED_PAIRS) {
      truncated = true;

      break;
    }

    const tokenKey = pair.token.toLowerCase();

    const count = perToken.get(tokenKey) ?? 0;

    if (count >= MAX_SPENDERS_PER_TOKEN) {
      truncated = true;

      continue;
    }

    perToken.set(tokenKey, count + 1);

    out.push(pair);
  }

  return { pairs: out, truncated };
}

// Decide which blocks to read this run. A wallet that has never been scanned
// is backfilled from genesis; one that has been scanned resumes just behind its
// last frontier, re-reading a small overlap so a chain reorg near the tip
// cannot drop an approval. Never returns from > to.
export function planScanRange({
  lastScannedBlock,
  latestBlock,
  reorgOverlap,
  genesisBlock = 0n,
}: {
  lastScannedBlock: bigint | null;

  latestBlock: bigint;

  reorgOverlap: bigint;

  genesisBlock?: bigint;
}): ScanRange | null {
  if (latestBlock < genesisBlock) {
    return null;
  }

  if (lastScannedBlock === null) {
    return { fromBlock: genesisBlock, toBlock: latestBlock };
  }

  const anchor =
    lastScannedBlock < latestBlock ? lastScannedBlock : latestBlock;

  const rawFrom = anchor - reorgOverlap;

  const fromBlock = rawFrom < genesisBlock ? genesisBlock : rawFrom;

  return { fromBlock, toBlock: latestBlock };
}

// Split a range into windows an RPC will actually answer. eth_getLogs caps its
// response, so history must be walked in chunks rather than one huge query.
export function chunkRange(range: ScanRange, chunkSize: bigint): ScanRange[] {
  if (chunkSize <= 0n) {
    throw new Error("chunkSize must be positive");
  }

  const chunks: ScanRange[] = [];

  let start = range.fromBlock;

  while (start <= range.toBlock) {
    const rawEnd = start + chunkSize - 1n;

    const end = rawEnd > range.toBlock ? range.toBlock : rawEnd;

    chunks.push({ fromBlock: start, toBlock: end });

    start = end + 1n;
  }

  return chunks;
}

// Coverage is complete only if we reached the chain AND every planned chunk was
// read. A single failed window, or an unreachable node, makes the whole answer
// partial — it must never be dressed up as "nothing found".
export function computeCoverage(
  outcomes: ChunkOutcome[],
  discoveryReachedChain = true,
): Coverage {
  if (!discoveryReachedChain) {
    return "partial";
  }

  return outcomes.every((outcome) => outcome.ok) ? "complete" : "partial";
}

// How far we may safely claim to have scanned: the end of the first unbroken
// run of successful chunks. If the first chunk failed we do not advance at all,
// so the gap is retried next run instead of being skipped forever.
export function scannedFrontier(
  outcomes: ChunkOutcome[],
  previous: bigint | null,
): bigint | null {
  let frontier = previous;

  for (const outcome of outcomes) {
    if (!outcome.ok) {
      break;
    }

    frontier = outcome.range.toBlock;
  }

  return frontier;
}

// A corrupt or version-mismatched blob resets to "never scanned" so the next
// run backfills from scratch rather than trusting half-readable state.
export function parseDiscoveryState(raw: string | null): DiscoveryState {
  if (!raw) {
    return { lastScannedBlock: null, pairs: [] };
  }

  try {
    const parsed = JSON.parse(raw) as {
      version?: unknown;

      lastScannedBlock?: unknown;

      pairs?: unknown;
    };

    if (parsed.version !== STATE_VERSION) {
      return { lastScannedBlock: null, pairs: [] };
    }

    let lastScannedBlock: bigint | null = null;

    if (typeof parsed.lastScannedBlock === "string") {
      try {
        lastScannedBlock = BigInt(parsed.lastScannedBlock);
      } catch {
        lastScannedBlock = null;
      }

      if (lastScannedBlock !== null && lastScannedBlock < 0n) {
        lastScannedBlock = null;
      }
    }

    const pairs: SpenderPair[] = [];

    if (Array.isArray(parsed.pairs)) {
      for (const item of parsed.pairs) {
        if (
          item &&
          typeof item === "object" &&
          typeof (item as { token?: unknown }).token === "string" &&
          typeof (item as { spender?: unknown }).spender === "string"
        ) {
          const pair = normalizePair(
            (item as { token: string }).token,
            (item as { spender: string }).spender,
          );

          if (pair) {
            pairs.push(pair);
          }
        }
      }
    }

    return { lastScannedBlock, pairs: mergePairs(pairs) };
  } catch {
    return { lastScannedBlock: null, pairs: [] };
  }
}

export function serializeDiscoveryState(state: DiscoveryState): string {
  return JSON.stringify({
    version: STATE_VERSION,

    lastScannedBlock:
      state.lastScannedBlock === null ? null : state.lastScannedBlock.toString(),

    pairs: state.pairs.map((pair) => ({
      token: pair.token.toLowerCase(),

      spender: pair.spender.toLowerCase(),
    })),
  });
}
