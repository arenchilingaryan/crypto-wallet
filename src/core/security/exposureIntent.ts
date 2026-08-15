// Refusing to act on a policy we cannot read is the right default, but it must
// not extend to taking permissions away. Blocking a revoke because the limits
// file is corrupt would leave the user exposed to a contract they are actively
// trying to cut off, which is the opposite of failing safe.
//
// This is the transaction-level counterpart of the `intent.revoking` carve-out
// in decidePolicy; the two must name the same set of operations.
const EXPOSURE_REDUCING_KINDS = new Set(["erc20-revoke", "permit2-revoke"]);

export function reducesExposureOnly(kind: string): boolean {
  return EXPOSURE_REDUCING_KINDS.has(kind);
}
