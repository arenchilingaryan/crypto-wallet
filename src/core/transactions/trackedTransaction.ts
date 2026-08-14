import type { Address, Hash } from "viem";

export type TrackedTransactionStatus = "pending" | "confirmed" | "reverted";

export type TrackedTransaction = {
  version: 1;

  hash: Hash;

  chainId: number;

  walletId: string;

  from: Address;

  to: Address;

  assetType: "native" | "erc20" | "swap" | "approve";

  symbol: string;

  valueWei: string;

  tokenDecimals?: number;

  valueUsd?: number | null;

  contractAddress?: Address | null;

  symbolOut?: string;

  valueOutWei?: string;

  contractAddressOut?: Address | null;

  tokenOutDecimals?: number;

  minAmountOutWei?: string | null;

  actualAmountOutWei?: string | null;

  createdAt: number;

  status: TrackedTransactionStatus;

  blockNumber: string | null;

  gasUsed: string | null;

  effectiveGasPriceWei: string | null;

  confirmedAt: number | null;
};
