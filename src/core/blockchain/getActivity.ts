import {
    formatUnits,
    getAddress,
    isAddress,
    type Address,
    type Hash,
} from "viem";

import { ACTIVE_NETWORK } from "@/constants/networks";

import type { ActivityItem } from "./activity";

const API_KEY = process.env.EXPO_PUBLIC_ALCHEMY_API_KEY;

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

  /*
   * Предпочитаем raw integer value,
   * чтобы не зависеть от JS float.
   */
  if (rawValue && decimals !== null) {
    try {
      return formatUnits(BigInt(rawValue), decimals);
    } catch {
      // fallback ниже
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
): Promise<AlchemyTransfer[]> {
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

            category: ["external", "erc20"],

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

  return result.result?.transfers ?? [];
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

  const wallet = walletAddress.toLowerCase();

  const direction = from.toLowerCase() === wallet ? "sent" : "received";

  const assetType = transfer.category === "erc20" ? "erc20" : "native";

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

  /*
   * Self-transfer попадёт
   * сразу в оба запроса.
   *
   * uniqueId у transfer
   * используем для dedupe.
   */
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
