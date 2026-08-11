import type { Address, Hash } from "viem";

export type TrackedTransactionStatus = "pending" | "confirmed" | "reverted";

export type TrackedTransaction = {
  version: 1;

  hash: Hash;

  chainId: number;

  walletId: string;

  from: Address;

  to: Address;

  assetType: "native";

  symbol: string;

  valueWei: string;

  createdAt: number;

  status: TrackedTransactionStatus;

  blockNumber: string | null;

  gasUsed: string | null;

  effectiveGasPriceWei: string | null;

  confirmedAt: number | null;
};
