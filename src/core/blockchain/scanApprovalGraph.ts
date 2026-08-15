import type { Address, PublicClient } from "viem";

import type { KeyValueStorage } from "@/core/ports/keyValueStorage";

import {
  capPairs,
  chunkRange,
  computeCoverage,
  extractCandidatePairs,
  mergePairs,
  parseDiscoveryState,
  planScanRange,
  scannedFrontier,
  serializeDiscoveryState,
  type ApprovalLogRecord,
  type ChunkOutcome,
  type ScanRange,
  type SpenderPair,
} from "./approvalDiscovery";
import type { PortfolioAsset } from "./getPortfolio";
import {
  getApprovals,
  type ApprovalScan,
  type DiscoveredApproval,
} from "./getApprovals";

// The chain reads discovery needs, narrowed so the orchestrator can be driven
// by a trivial fake in tests. The platform adapter implements this over viem.
export interface ApprovalDiscoveryChain {
  getLatestBlock(): Promise<bigint>;

  // ERC-20 Approval logs where the wallet is the owner, within one block
  // window. May throw — a throw marks that window unread, not empty.
  getApprovalLogs(owner: Address, range: ScanRange): Promise<ApprovalLogRecord[]>;
}

const DEFAULT_CHUNK_SIZE = 500_000n;

const DEFAULT_REORG_OVERLAP = 12n;

const STORAGE_PREFIX = "permissiongraph.discovery.v1";

function storageKey(networkId: string, owner: Address): string {
  return `${STORAGE_PREFIX}.${networkId}.${owner.toLowerCase()}`;
}

async function safeGet(
  storage: KeyValueStorage,
  key: string,
): Promise<string | null> {
  try {
    return await storage.get(key);
  } catch {
    return null;
  }
}

// Discover unknown historical ERC-20 spenders, fold them into the persisted
// candidate set, then let getApprovals resolve every candidate against its
// current on-chain allowance. Persistence advances only over the contiguous
// run of successfully read blocks, so a failed window is retried, never
// skipped, and the answer's coverage is reported honestly.
export async function scanApprovalGraph({
  owner,
  assets,
  networkId,
  client,
  storage,
  discovery,
  chunkSize = DEFAULT_CHUNK_SIZE,
  reorgOverlap = DEFAULT_REORG_OVERLAP,
}: {
  owner: Address;

  assets: PortfolioAsset[];

  networkId: string;

  client: PublicClient;

  storage: KeyValueStorage;

  discovery: ApprovalDiscoveryChain;

  chunkSize?: bigint;

  reorgOverlap?: bigint;
}): Promise<ApprovalScan> {
  const key = storageKey(networkId, owner);

  const prior = parseDiscoveryState(await safeGet(storage, key));

  let discoveryReachedChain = true;

  const outcomes: ChunkOutcome[] = [];

  let discoveredPairs: SpenderPair[] = [];

  let frontier = prior.lastScannedBlock;

  try {
    const latestBlock = await discovery.getLatestBlock();

    const range = planScanRange({
      lastScannedBlock: prior.lastScannedBlock,

      latestBlock,

      reorgOverlap,
    });

    if (range) {
      const chunks = chunkRange(range, chunkSize);

      const records: ApprovalLogRecord[] = [];

      for (const chunk of chunks) {
        try {
          const logs = await discovery.getApprovalLogs(owner, chunk);

          records.push(...logs);

          outcomes.push({ range: chunk, ok: true });
        } catch {
          outcomes.push({ range: chunk, ok: false });
        }
      }

      discoveredPairs = extractCandidatePairs(records);

      frontier = scannedFrontier(outcomes, prior.lastScannedBlock);
    }
  } catch {
    // Could not even learn the chain head — no discovery this run. Keep the
    // prior frontier and let coverage fall to partial.
    discoveryReachedChain = false;
  }

  // Put this run's evidence before persisted candidates so a saturated legacy
  // cache cannot hide a newly created live approval behind stale zero entries.
  // The set remains bounded; hitting the bound forces partial coverage rather
  // than a silent claim that discovery was complete.
  const { pairs: allPairs, truncated } = capPairs(
    mergePairs(discoveredPairs, prior.pairs),
  );

  const held = new Set(
    assets
      .filter((asset) => asset.type === "erc20" && asset.contractAddress)
      .map((asset) => (asset.contractAddress as string).toLowerCase()),
  );

  // Unheld discovered tokens carry no portfolio metadata; getApprovals falls
  // back to an address placeholder. (Metadata enrichment is a later step.)
  const discoveredInput: DiscoveredApproval[] = allPairs.map((pair) => ({
    token: pair.token,

    spender: pair.spender,

    tokenMeta: held.has(pair.token.toLowerCase()) ? undefined : null,
  }));

  const coverage =
    truncated
      ? "partial"
      : computeCoverage(outcomes, discoveryReachedChain);

  const scan = await getApprovals(owner, assets, networkId, client, {
    discovered: discoveredInput,

    coverage,
  });

  const nextState = {
    lastScannedBlock: discoveryReachedChain ? frontier : prior.lastScannedBlock,

    // Current allowance is authoritative: keep live and unreadable candidates,
    // but do not let confirmed-zero history permanently consume the cap.
    pairs: [...(scan.retainedDirectPairs ?? allPairs)],
  };

  try {
    await storage.set(key, serializeDiscoveryState(nextState));
  } catch {
    // Persisting the frontier is an optimisation; failing it only means the
    // next run re-reads more history, which is safe.
  }

  return scan;
}
