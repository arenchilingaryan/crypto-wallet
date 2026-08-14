export type BroadcastObservation = {
  receipt: "success" | "reverted" | null;

  transactionSeen: boolean;

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

  if (observation.transactionSeen) {
    return { action: "mark-pending" };
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
