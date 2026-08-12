import type { Address, Hash } from "viem";

export type ActivityDirection = "sent" | "received";

export type ActivityStatus = "pending" | "confirmed" | "reverted";

export type ActivityItem = {
  id: string;

  hash: Hash;

  status: ActivityStatus;

  direction: ActivityDirection;

  assetType: "native" | "erc20" | "swap" | "approve";

  symbol: string;

  amount: string;

  from: Address;

  to: Address | null;

  contractAddress: Address | null;

  blockNumber: bigint | null;

  timestamp: number | null;

  // Только для swap: купленная сторона.
  symbolOut?: string;

  amountOut?: string;
};
