import {
  formatUnits,
  getAddress,
  isAddress,
  type Address,
  type Hash,
} from "viem";

import { ACTIVE_NETWORK } from "@/constants/networks";

import { getDataApiKey } from "@/core/config/runtimeConfig";

import {
  resolveDirection,
  type ActivityItem,
  type ActivityOrigin,
} from "./activity";

type AlchemyTransfer = {
  uniqueId: string;

  hash: string;

  blockNum: string;

  from: string;

  to?: string | null;

  value?: number | null;

  asset?: string | null;

  category: "external" | "erc20" | string;

  rawContract?: {
    value?: string | null;

    address?: string | null;

    decimal?: string | null;
  };

  metadata?: {
    blockTimestamp?: string;
  };
};

type AlchemyTransferResponse = {
  jsonrpc: "2.0";

  id: number;

  result?: {
    transfers: AlchemyTransfer[];

    pageKey?: string;
  };

  error?: {
    code: number;
    message: string;
  };
};

type TransferFilter = {
  fromAddress?: Address;

  toAddress?: Address;
};

function normalizeAddress(value: string | null | undefined): Address | null {
  if (
    !value ||
    !isAddress(value, {
      strict: false,
    })
  ) {
    return null;
  }

  return getAddress(value);
}

function parseDecimals(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const decimals = Number.parseInt(value, 16);

  if (!Number.isFinite(decimals)) {
    return null;
  }

  return decimals;
}

function formatTransferAmount(transfer: AlchemyTransfer): string {
  const rawValue = transfer.rawContract?.value;

  const decimals = parseDecimals(transfer.rawContract?.decimal);

  if (rawValue && decimals !== null) {
    try {
      return formatUnits(BigInt(rawValue), decimals);
    } catch {
      void 0;
    }
  }

  if (typeof transfer.value === "number" && Number.isFinite(transfer.value)) {
    return String(transfer.value);
  }

  return "0";
}

function parseTimestamp(transfer: AlchemyTransfer): number | null {
  const timestamp = transfer.metadata?.blockTimestamp;

  if (!timestamp) {
    return null;
  }

  const parsed = new Date(timestamp).getTime();

  return Number.isFinite(parsed) ? parsed : null;
}

async function requestTransfers(
  filter: TransferFilter,
  options?: { categories?: string[] },
): Promise<AlchemyTransfer[]> {
  const API_KEY = getDataApiKey();

  if (!API_KEY) {
    throw new Error("Alchemy API key is missing");
  }

  const response = await fetch(
    `https://${ACTIVE_NETWORK.id}.g.alchemy.com/v2/${API_KEY}`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        jsonrpc: "2.0",

        id: 1,

        method: "alchemy_getAssetTransfers",

        params: [
          {
            fromBlock: "0x0",

            toBlock: "latest",

            ...filter,

            category: options?.categories ?? ["external", "internal", "erc20"],

            excludeZeroValue: true,

            withMetadata: true,

            order: "desc",

            maxCount: "0x32",
          },
        ],
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Activity request failed: ${response.status}`);
  }

  const result = (await response.json()) as AlchemyTransferResponse;

  if (result.error) {
    throw new Error(result.error.message);
  }

  // A 200 with neither an error nor a result object is a malformed/undocumented
  // response — treat it as a failed read, not as an empty history, so callers
  // that judge coverage do not mistake "could not read" for "nothing here".
  if (!result.result) {
    throw new Error("Activity response was missing its result");
  }

  return result.result.transfers ?? [];
}

function mapTransfer(
  transfer: AlchemyTransfer,

  walletAddress: Address,
): ActivityItem | null {
  const from = normalizeAddress(transfer.from);

  if (!from) {
    return null;
  }

  const to = normalizeAddress(transfer.to);

  const contractAddress = normalizeAddress(transfer.rawContract?.address);

  const direction = resolveDirection(from, to, walletAddress);

  const assetType = transfer.category === "erc20" ? "erc20" : "native";

  const origin: ActivityOrigin =
    transfer.category === "external" ? "native-transfer" : "token-log";

  let blockNumber: bigint | null = null;

  try {
    blockNumber = BigInt(transfer.blockNum);
  } catch {
    blockNumber = null;
  }

  return {
    id: transfer.uniqueId,

    hash: transfer.hash as Hash,

    status: "confirmed",

    direction,

    origin,

    assetType,

    symbol:
      transfer.asset ??
      (assetType === "native" ? ACTIVE_NETWORK.nativeSymbol : "TOKEN"),

    amount: formatTransferAmount(transfer),

    from,

    to,

    contractAddress: assetType === "erc20" ? contractAddress : null,

    blockNumber,

    timestamp: parseTimestamp(transfer),
  };
}

// The addresses the user has PROVABLY chosen to send to on-chain: direct native
// sends only, where the wallet itself is the sender. An ERC-20 `Transfer` log
// where `from` is the wallet does not prove the user typed that `to` — a
// contract could have moved the tokens on their behalf — so it is not counted.
// Crucially, incoming transfers are excluded: a poisoning lookalike arrives as
// an inbound dust transfer, and letting its sender into this set would mark the
// attacker's address as "known" — inverting the defence. Pure so the filter is
// directly testable. This set proves familiarity, never its absence: because
// ERC-20 sends are deliberately out of scope, "not here" is never "never sent".
export function provenRecipientsFromTransfers(
  owner: Address,
  transfers: { category: string; from: string; to?: string | null }[],
): Address[] {
  const ownerLower = owner.toLowerCase();

  const recipients = new Set<string>();

  for (const transfer of transfers) {
    if (transfer.category !== "external") {
      continue;
    }

    const from = normalizeAddress(transfer.from);

    const to = normalizeAddress(transfer.to);

    if (!from || !to) {
      continue;
    }

    if (from.toLowerCase() !== ownerLower) {
      continue;
    }

    recipients.add(to.toLowerCase());
  }

  return [...recipients] as Address[];
}

export async function getProvenRecipients(owner: Address): Promise<Address[]> {
  // Ask only for direct native sends, so the single page's budget is spent on
  // the transfers that actually feed the reference set rather than being
  // crowded out by ERC-20 logs on a busy wallet.
  return provenRecipientsFromTransfers(
    owner,
    await requestTransfers({ fromAddress: owner }, { categories: ["external"] }),
  );
}

export async function getActivity(
  walletAddress: Address,
): Promise<ActivityItem[]> {
  const [outgoing, incoming] = await Promise.all([
    requestTransfers({
      fromAddress: walletAddress,
    }),

    requestTransfers({
      toAddress: walletAddress,
    }),
  ]);

  const transfers = new Map<string, AlchemyTransfer>();

  for (const transfer of [...outgoing, ...incoming]) {
    transfers.set(transfer.uniqueId, transfer);
  }

  const items = [...transfers.values()]
    .map((transfer) => mapTransfer(transfer, walletAddress))
    .filter((item): item is ActivityItem => item !== null);

  items.sort((a, b) => {
    if (
      a.timestamp !== null &&
      b.timestamp !== null &&
      a.timestamp !== b.timestamp
    ) {
      return b.timestamp - a.timestamp;
    }

    if (a.blockNumber !== null && b.blockNumber !== null) {
      if (a.blockNumber > b.blockNumber) {
        return -1;
      }

      if (a.blockNumber < b.blockNumber) {
        return 1;
      }
    }

    return 0;
  });

  return items;
}
