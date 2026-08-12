import type { Address, Hash } from "viem";

export type TrackedTransactionStatus = "pending" | "confirmed" | "reverted";

export type TrackedTransaction = {
  version: 1;

  hash: Hash;

  chainId: number;

  walletId: string;

  from: Address;

  // Для ERC-20 здесь человеческий получатель токенов, не контракт.
  // Для swap — роутер, для approve — контракт токена.
  to: Address;

  assetType: "native" | "erc20" | "swap" | "approve";

  // Для swap — символ ПРОДАННОГО актива.
  symbol: string;

  // Сырые единицы: wei для ETH, минимальные единицы токена для ERC-20.
  // Для swap — сумма входа, для approve — разрешённая сумма.
  valueWei: string;

  // Только для ERC-20 / swap (вход) / approve.
  tokenDecimals?: number;

  contractAddress?: Address | null;

  // Только для swap: купленная сторона (котировка на момент отправки).
  symbolOut?: string;

  valueOutWei?: string;

  tokenOutDecimals?: number;

  createdAt: number;

  status: TrackedTransactionStatus;

  blockNumber: string | null;

  gasUsed: string | null;

  effectiveGasPriceWei: string | null;

  confirmedAt: number | null;
};
