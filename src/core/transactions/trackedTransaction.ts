import type { Address, Hash } from "viem";

export type TrackedTransactionStatus =
  | "broadcast-pending"
  | "broadcast-unknown"
  | "pending"
  | "confirmed"
  | "reverted";

export function countsAgainstOutflow(status: TrackedTransactionStatus) {
  return status !== "reverted";
}

export function isAwaitingChain(status: TrackedTransactionStatus) {
  return (
    status === "broadcast-pending" ||
    status === "broadcast-unknown" ||
    status === "pending"
  );
}

export function describeTrackedStatus(status: TrackedTransactionStatus) {
  switch (status) {
    case "broadcast-pending":
      return "Being sent";

    case "broadcast-unknown":
      return "Delivery unconfirmed";

    case "pending":
      return "Pending";

    case "confirmed":
      return "Confirmed";

    case "reverted":
      return "Failed";
  }
}

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

  nonce?: number | null;

  signedRawTx?: string | null;

  createdAt: number;

  status: TrackedTransactionStatus;

  blockNumber: string | null;

  gasUsed: string | null;

  effectiveGasPriceWei: string | null;

  confirmedAt: number | null;
};
