// What the chain actually told us about a transaction we broadcast (or tried
// to). "not-found" is a positive answer from a reachable node; "unknown" is the
// absence of an answer. Collapsing the two lets a provider outage look like
// proof that a transaction was replaced, which is how a still-valid outflow
// gets terminalised and silently drops out of daily accounting.
export type TransactionPresence = "seen" | "not-found" | "unknown";

export type BroadcastObservation = {
  receipt: "success" | "reverted" | null;

  presence: TransactionPresence;

  accountNonce: number | null;

  txNonce: number | null;

  hasSignedTransaction: boolean;
};

export type BroadcastResolution =
  | { action: "confirm"; status: "confirmed" | "reverted" }
  | { action: "mark-pending" }
  | { action: "rebroadcast" }
  | { action: "supersede" }
  | { action: "wait" };

export function resolveBroadcast(
  observation: BroadcastObservation,
): BroadcastResolution {
  if (observation.receipt !== null) {
    return {
      action: "confirm",

      status: observation.receipt === "success" ? "confirmed" : "reverted",
    };
  }

  if (observation.presence === "seen") {
    return { action: "mark-pending" };
  }

  // We could not reach the node, or it answered with something we cannot
  // interpret. Nothing here is evidence about the transaction, so no terminal
  // state and no resend: wait and ask again later.
  if (observation.presence === "unknown") {
    return { action: "wait" };
  }

  const { accountNonce, txNonce } = observation;

  if (
    accountNonce !== null &&
    txNonce !== null &&
    Number.isInteger(accountNonce) &&
    Number.isInteger(txNonce) &&
    accountNonce > txNonce
  ) {
    return { action: "supersede" };
  }

  if (observation.hasSignedTransaction) {
    return { action: "rebroadcast" };
  }

  return { action: "wait" };
}
