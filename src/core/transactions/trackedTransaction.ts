import type { Address, Hash } from "viem";

export type TrackedTransactionStatus = "pending" | "confirmed" | "reverted";

export type TrackedTransaction = {
  version: 1;

  hash: Hash;

  chainId: number;

  walletId: string;

  from: Address;

  // Для ERC-20 здесь человеческий получатель токенов, не контракт.
  to: Address;

  assetType: "native" | "erc20";

  symbol: string;

  // Сырые единицы: wei для ETH, минимальные единицы токена для ERC-20.
  valueWei: string;

  // Только для ERC-20.
  tokenDecimals?: number;

  contractAddress?: Address | null;

  createdAt: number;

  status: TrackedTransactionStatus;

  blockNumber: string | null;

  gasUsed: string | null;

  effectiveGasPriceWei: string | null;

  confirmedAt: number | null;
};
