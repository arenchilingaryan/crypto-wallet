import { type Address } from "viem";

import { addressFingerprint } from "@/core/blockchain/addressFingerprint";

// Two INDEPENDENT axes about the address a user is about to send to:
//
//   identity   — have I proven I chose to send here before? (familiarity)
//   lookalike  — does this collide, under the shortened form I actually read,
//                with a DIFFERENT address I have used? (visual confusion)
//
// They are deliberately not one enum. An address can be both previously used
// and a lookalike of another; collapsing them would let familiarity suppress
// the exact warning poisoning depends on. And "previously-sent" is never
// "trusted/safe" — it only means we have seen it before.
//
// Honest v1 boundaries (documented, not silently pretended away):
//   - The on-chain reference set is native sends only; ERC-20 recipients enter
//     it only via this device's tracked history. A USDT/USDC lookalike after a
//     reinstall or on another device can go unwarned. This is the main blind
//     spot. Mixing in inbound transfers is NOT the fix — that is the very
//     channel poisoning arrives through.
//   - The first send to any address has no prior twin to compare against, so
//     the very first interaction is never flagged.
//   - Only hex-shape lookalikes are detected; ENS names, clipboard substitution
//     to an unrelated address, and Unicode homoglyphs are out of scope.

export type RecipientIdentity =
  | "self"
  | "previously-sent"
  | "first-time"
  | "not-seen"
  | "unknown";

export type HistoryCoverage = "complete" | "partial" | "unavailable";

export type RecipientLookalike = {
  fingerprint: string;

  matches: Address[];
};

export type RecipientIntelligence = {
  identity: RecipientIdentity;

  historyCoverage: HistoryCoverage;

  lookalike: RecipientLookalike | null;
};

export function analyzeRecipient({
  recipient,
  ownAddress,
  provenRecipients,
  historyCoverage,
}: {
  recipient: Address;

  ownAddress: Address;

  // Addresses the user has PROVABLY chosen to send to (direct native sends and
  // locally-signed transactions) — never incoming transfers, which is how a
  // poisoning lookalike gets planted in the first place.
  provenRecipients: Address[];

  historyCoverage: HistoryCoverage;
}): RecipientIntelligence {
  const target = recipient.toLowerCase();

  const own = ownAddress.toLowerCase();

  // Dedupe the reference set by normalized address, keeping the first casing
  // seen so a match can be displayed as it was recorded.
  const provenByKey = new Map<string, Address>();

  for (const address of provenRecipients) {
    const key = address.toLowerCase();

    if (!provenByKey.has(key)) {
      provenByKey.set(key, address);
    }
  }

  // Identity is a monotone ladder. "self" and "previously-sent" are proven
  // facts. "first-time" is the strong claim "you have never sent here" — which
  // holds ONLY if the CALLER vouches its history is genuinely complete. With
  // partial history, absence is "not-seen-in-what-we-saw", not proof of never;
  // with no history at all it is "unknown". Absence of evidence is not evidence
  // of absence. (This wallet's adapter can only see native sends plus local
  // tracked history, so it never claims "complete" — it passes "partial" — and
  // "first-time" is therefore not reached in production. The branch stays for a
  // caller that ever does have complete history.)
  let identity: RecipientIdentity;

  if (target === own) {
    identity = "self";
  } else if (provenByKey.has(target)) {
    identity = "previously-sent";
  } else if (historyCoverage === "unavailable") {
    identity = "unknown";
  } else if (historyCoverage === "complete") {
    identity = "first-time";
  } else {
    identity = "not-seen";
  }

  // Lookalike is computed independently of identity: scan the reference set for
  // a DIFFERENT address that shortens to the same fingerprint. Insertion order
  // is preserved so the result is deterministic.
  const fingerprint = addressFingerprint(recipient);

  const matches: Address[] = [];

  for (const [key, address] of provenByKey) {
    if (key === target) {
      continue;
    }

    if (addressFingerprint(address) === fingerprint) {
      matches.push(address);
    }
  }

  return {
    identity,

    historyCoverage,

    lookalike: matches.length > 0 ? { fingerprint, matches } : null,
  };
}
