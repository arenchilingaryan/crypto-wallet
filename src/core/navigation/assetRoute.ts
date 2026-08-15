import type { Address } from "viem";

// The domain identity of a token is (chainId, address). A route that carries
// only the address quietly drops half of it and lets whatever network happens to
// be active stand in — which is correct exactly until it isn't. Keeping the pair
// intact on the navigation boundary costs one parameter and means the screen
// opens the token that was tapped, not one that merely shares its address.
//
// This is NOT cross-chain UI: the app still runs on one network. It only stops
// the boundary from being the place where the contract is lost.

export type AssetRouteParams = {
  id: string;

  chainId: string;
};

export function assetRouteParams({
  chainId,
  address,
}: {
  chainId: number;

  address: Address | string;
}): AssetRouteParams {
  return {
    id: String(address),

    chainId: String(chainId),
  };
}

// Canonical identity of whatever a route points at. Two routes are the same
// asset only if both halves match.
export function assetRouteKey({
  chainId,
  id,
}: {
  chainId: number;

  id: string;
}): string {
  return `${chainId}:${id.toLowerCase()}`;
}

// Routes are strings from the outside world: a missing, malformed or hostile
// chainId falls back to the network the app is actually running on rather than
// producing NaN and a silently wrong identity.
export function parseRouteChainId(
  raw: string | string[] | undefined,
  fallbackChainId: number,
): number {
  const value = Array.isArray(raw) ? raw[0] : raw;

  if (typeof value !== "string") {
    return fallbackChainId;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallbackChainId;
}
