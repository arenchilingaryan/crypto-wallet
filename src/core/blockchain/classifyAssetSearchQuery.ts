import { getAddress, isAddress, type Address } from "viem";

export type AssetSearchQuery =
  | {
      type: "empty";
    }
  | {
      type: "address";
      address: Address;
    }
  | {
      type: "text";
      query: string;
    };

export function classifyAssetSearchQuery(rawQuery: string): AssetSearchQuery {
  const query = rawQuery.trim();

  if (!query) {
    return {
      type: "empty",
    };
  }

  if (
    isAddress(query, {
      strict: false,
    })
  ) {
    return {
      type: "address",
      address: getAddress(query),
    };
  }

  return {
    type: "text",
    query,
  };
}
