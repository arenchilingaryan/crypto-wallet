import type { Address, Hash } from "viem";

export type TransactionDetailsStatus = "pending" | "confirmed" | "reverted";

export type TransactionDetails = {
  hash: Hash;

  status: TransactionDetailsStatus;

  network: string;

  chainId: number;

  from: Address;

  to: Address | null;

  valueWei: bigint;

  gasUsed: bigint | null;

  gasPriceWei: bigint | null;

  networkFeeWei: bigint | null;

  blockNumber: bigint | null;

  timestamp: number | null;
};
