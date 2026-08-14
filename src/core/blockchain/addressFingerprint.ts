// The single source of truth for how an address is shortened for a human.
//
// Both the UI (`shortenAddress`) and the poisoning detector derive from this
// one function, on purpose: the representation a user visually verifies must be
// exactly the representation security compares. If the UI shortened to, say,
// 6+4 while the detector still compared 4+4, an attacker could craft an address
// that looks identical to the user yet slips past the check — the whole feature
// would quietly stop working. Keep them fused.

export function truncateAddress(address: string): string {
  // A real address is 42 chars. Guard degenerate short inputs where the head
  // (6) and tail (4) slices would overlap: two different strings could then
  // collapse to the same shortening, which for the fingerprint would be a false
  // lookalike match. Below the overlap threshold, show the value whole.
  if (address.length < 10) {
    return address;
  }

  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

// The case-insensitive form used for comparison. Poisoning exploits the shape a
// user reads, not its checksum casing, so the fingerprint is lower-cased.
export function addressFingerprint(address: string): string {
  return truncateAddress(address.toLowerCase());
}
