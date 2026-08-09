import type { Address } from "viem";

export type AssetSearchResult = {
  type: "native" | "erc20";

  symbol: string;
  name: string;

  contractAddress: Address | null;

  logo: string | null;

  source: "native" | "wallet" | "network";

  balance: string | null;
};
