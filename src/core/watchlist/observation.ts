import {
  UNKNOWN,
  type TokenIntelligence,
} from "@/core/token-intelligence/types";

// A watchlist row projects the EXISTING Token Intelligence snapshot. It does not
// score anything: "critical" here means exactly what it means on Token Details,
// because it is the same object. Inventing a simplified watchlist risk would let
// two screens disagree about the same token, which is worse than no screen.

export type WatchRowStatus =
  // Nothing has been asked for yet.
  | "idle"
  // Asking for the first time — there is nothing to show underneath.
  | "checking"
  // We have something to show and are asking again on top of it.
  | "refreshing"
  | "current"
  | "stale"
  // Some providers answered, others did not: not a clean result.
  | "partial"
  // Asked and got nothing usable.
  | "unavailable"
  // The network itself is not covered by the risk providers. Distinct from a
  // provider being down: retrying will never help, and it is not an error.
  | "unsupported";

export type WatchRowValue<T> =
  | { known: true; value: T }
  | { known: false };

export type WatchRowObservation = {
  status: WatchRowStatus;

  // Verbatim from the shared summary, so wording cannot drift between screens.
  riskTitle: string | null;

  riskKind: TokenIntelligence["summary"]["kind"] | null;

  // A missing price is an absence of information, never a zero valuation. The
  // two must stay distinguishable all the way to the screen.
  priceUsd: WatchRowValue<number>;

  liquidityUsd: WatchRowValue<number>;

  // When the underlying data was actually observed, for an honest "checked N
  // ago". Null when nothing has ever been observed.
  checkedAt: number | null;
};

function unknownValue<T>(): WatchRowValue<T> {
  return { known: false };
}

export function buildWatchRowObservation({
  intelligence,
  refreshing,
  priceUsd = null,
}: {
  intelligence: TokenIntelligence | null;

  refreshing: boolean;

  // Null means "we have no price for this token", which is the normal case for
  // something the wallet does not hold. It is never rendered as $0.
  priceUsd?: number | null;
}): WatchRowObservation {
  const price: WatchRowValue<number> =
    priceUsd === null || !Number.isFinite(priceUsd)
      ? unknownValue()
      : { known: true, value: priceUsd };

  if (!intelligence) {
    return {
      status: refreshing ? "checking" : "idle",

      riskTitle: null,

      riskKind: null,

      priceUsd: price,

      liquidityUsd: unknownValue(),

      checkedAt: null,
    };
  }

  const liquidityValue = intelligence.liquidity.totalLiquidityUsd.value;

  const liquidityUsd: WatchRowValue<number> =
    liquidityValue === UNKNOWN
      ? unknownValue()
      : { known: true, value: liquidityValue };

  const checkedAt =
    intelligence.observedAt === UNKNOWN ? null : intelligence.observedAt;

  const overall = intelligence.availability.overall;

  // Order matters. "Unsupported" and "unavailable" describe what we know, and
  // must not be painted over by the fact that a refresh happens to be running;
  // conversely a running refresh must never make a stale figure look current.
  let status: WatchRowStatus;

  if (overall === "unsupported") {
    status = "unsupported";
  } else if (overall === "unavailable") {
    status = refreshing && checkedAt === null ? "checking" : "unavailable";
  } else if (overall === "loading" || refreshing) {
    status = checkedAt === null ? "checking" : "refreshing";
  } else if (overall === "partial") {
    status = "partial";
  } else if (
    // Anything that is not positively fresh is not current. Freshness has three
    // values, and "unknown" — which happens when an observation carries no
    // usable timestamp, or one in the future because two clocks disagree — is
    // an absence of knowledge about age, not a confirmation of youth.
    Object.values(intelligence.freshness).some(
      (facet) => facet !== "fresh",
    )
  ) {
    status = "stale";
  } else {
    status = "current";
  }

  return {
    status,

    riskTitle: intelligence.summary.title,

    riskKind: intelligence.summary.kind,

    priceUsd: price,

    liquidityUsd,

    checkedAt,
  };
}

// True when the row is showing something that is not a confirmed current fact,
// so the UI can mark it rather than letting an old value pass for a live one.
export function isProvisional(status: WatchRowStatus): boolean {
  return (
    status === "stale" ||
    status === "partial" ||
    status === "refreshing" ||
    status === "unavailable" ||
    status === "unsupported"
  );
}
