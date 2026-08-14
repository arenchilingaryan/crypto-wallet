import { getAddress, isAddress, type Address } from "viem";

export function normalizeTokenAddress(address: string): Address {
  if (!isAddress(address, { strict: false })) {
    throw new TypeError("Invalid token contract address");
  }

  return getAddress(address.toLowerCase());
}

export function normalizeProviderAddress(value: unknown): Address | null {
  if (typeof value !== "string" || !isAddress(value, { strict: false })) {
    return null;
  }

  return getAddress(value.toLowerCase());
}
