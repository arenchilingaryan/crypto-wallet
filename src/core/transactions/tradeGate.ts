import type { TokenIntelligence } from "@/core/token-intelligence/types";

export type TradeTarget = {
  chainId: number;

  address: string | null;
};

export type BriefedTrade = {
  target: TradeTarget;

  acknowledged: boolean;
};

export type TradeGateDecision =
  | { proceed: true; reason: "nothing-to-brief" | "briefing-acknowledged" }
  | {
      proceed: false;

      reason:
        | "briefing-required"
        | "briefing-not-acknowledged"
        | "briefing-for-another-token";
    };

export function sameTradeTarget(left: TradeTarget, right: TradeTarget) {
  if (left.chainId !== right.chainId) {
    return false;
  }

  if (left.address === null || right.address === null) {
    return left.address === right.address;
  }

  return left.address.toLowerCase() === right.address.toLowerCase();
}

export function outOfCoverage(intelligence: TokenIntelligence) {
  return (
    intelligence.availability.trade === "unsupported" &&
    intelligence.availability.contract === "unsupported"
  );
}

export function requiresTradeBriefing(intelligence: TokenIntelligence) {
  if (outOfCoverage(intelligence)) {
    return false;
  }

  return (
    intelligence.summary.kind !== "no-major-issues" ||
    intelligence.evidence.conflicts.length > 0 ||
    intelligence.availability.trade !== "available"
  );
}

export function tradeTargets({
  sold,
  bought,
}: {
  sold: TradeTarget;

  bought: TradeTarget;
}): TradeTarget[] {
  const targets = [sold, bought].filter(
    (target) => target.address !== null,
  );

  return targets.filter(
    (target, index) =>
      targets.findIndex((other) => sameTradeTarget(other, target)) === index,
  );
}

export function decideTradeGate({
  target,
  briefed,
}: {
  target: TradeTarget;

  briefed: BriefedTrade | null;
}): TradeGateDecision {
  if (target.address === null) {
    return { proceed: true, reason: "nothing-to-brief" };
  }

  if (briefed === null) {
    return { proceed: false, reason: "briefing-required" };
  }

  if (!sameTradeTarget(briefed.target, target)) {
    return { proceed: false, reason: "briefing-for-another-token" };
  }

  if (!briefed.acknowledged) {
    return { proceed: false, reason: "briefing-not-acknowledged" };
  }

  return { proceed: true, reason: "briefing-acknowledged" };
}

export function decideTradeGateForAll({
  targets,
  cleared,
}: {
  targets: TradeTarget[];

  cleared: BriefedTrade[];
}): TradeGateDecision {
  for (const target of targets) {
    const briefed = cleared.find((entry) =>
      sameTradeTarget(entry.target, target),
    );

    if (!briefed) {
      return {
        proceed: false,

        reason:
          cleared.length > 0 ? "briefing-for-another-token" : "briefing-required",
      };
    }

    if (!briefed.acknowledged) {
      return { proceed: false, reason: "briefing-not-acknowledged" };
    }
  }

  return { proceed: true, reason: "briefing-acknowledged" };
}

export function describeTradeGate(decision: TradeGateDecision): string | null {
  if (decision.proceed) {
    return null;
  }

  switch (decision.reason) {
    case "briefing-for-another-token":
      return "The token check on screen was for a different token. Start the swap again so it is checked.";

    case "briefing-not-acknowledged":
    case "briefing-required":
      return "This token has to be checked before the swap can be prepared.";
  }
}
