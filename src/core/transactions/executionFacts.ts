import { formatUnits, type Address, type Hex } from "viem";

export const ERC20_TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

export type ReceiptLog = {
  address: string;

  topics: readonly string[];

  data: string;
};

function topicAddress(topic: string | undefined): string | null {
  if (typeof topic !== "string" || topic.length !== 66) {
    return null;
  }

  return `0x${topic.slice(26)}`.toLowerCase();
}

export function creditedFromLogs({
  logs,
  owner,
  token,
}: {
  logs: readonly ReceiptLog[];

  owner: Address;

  token: Address;
}): bigint | null {
  const wallet = owner.toLowerCase();

  const contract = token.toLowerCase();

  let credited: bigint | null = null;

  for (const log of logs) {
    if (log.address.toLowerCase() !== contract) {
      continue;
    }

    if (log.topics[0]?.toLowerCase() !== ERC20_TRANSFER_TOPIC) {
      continue;
    }

    if (topicAddress(log.topics[2]) !== wallet) {
      continue;
    }

    let value: bigint;

    try {
      value = BigInt(log.data as Hex);
    } catch {
      continue;
    }

    credited = (credited ?? 0n) + value;
  }

  return credited;
}

export type ExecutionFacts = {
  amountIn: string;

  symbolIn: string;

  symbolOut: string;

  quotedAmountOut: string | null;

  minAmountOut: string | null;

  actualAmountOut: string | null;

  gasUsed: string | null;

  gasLimit: string | null;

  route: string | null;

  effectiveGasPriceWei: string | null;

  nativeSymbol: string;

  quotedAt: number | null;

  confirmedAt: number | null;
};

export function toDecimal(
  raw: string | null | undefined,
  decimals: number,
): string | null {
  if (raw === null || raw === undefined || raw === "") {
    return null;
  }

  try {
    return formatUnits(BigInt(raw), decimals);
  } catch {
    return null;
  }
}
