import type { Address } from "viem";

import {
  evaluateSecurityPolicy,
  type PolicyContext,
  type PolicyRule,
  type SecurityPolicy,
} from "./securityPolicy";

export type PolicyIntent =
  | {
      kind: "transfer";

      recipient: Address;

      amountUsd: number | null;
    }
  | {
      kind: "approval";

      spender: Address;

      spenderKnown: boolean;

      unlimited: boolean;

      revoking: boolean;

      exposureUsd: number | null;
    }
  | {
      kind: "swap";

      lossUsd: number | null;
    };

export type NetworkKind = "mainnet" | "testnet";

export type PriceAvailability = "available" | "unavailable";

export type PolicyEnforcement = "enforced" | "not-applicable" | "unavailable";

export type PolicyReason =
  | "within-limits"
  | "approval-revokes-access"
  | "approval-unlimited"
  | "approval-unknown-spender"
  | "approval-over-exposure"
  | "swap-over-loss"
  | "no-limits-configured"
  | "usd-policy-disabled-on-testnet"
  | "approval-policy-not-implemented"
  | "swap-policy-not-implemented"
  | "price-unavailable"
  | "history-unavailable"
  | "policy-unavailable"
  | "over-single-transfer"
  | "over-new-recipient"
  | "over-daily-outflow";

export type UncoveredReason = Extract<
  PolicyReason,
  | "approval-revokes-access"
  | "no-limits-configured"
  | "usd-policy-disabled-on-testnet"
  | "approval-policy-not-implemented"
  | "swap-policy-not-implemented"
>;

export type BlockReason = Extract<
  PolicyReason,
  | "approval-unlimited"
  | "approval-unknown-spender"
  | "approval-over-exposure"
  | "swap-over-loss"
  | "price-unavailable"
  | "history-unavailable"
  | "policy-unavailable"
  | "over-single-transfer"
  | "over-new-recipient"
  | "over-daily-outflow"
>;

export type PolicyDecision =
  | {
      decision: "allow";

      enforcement: "enforced";

      reason: "within-limits";
    }
  | {
      decision: "uncovered";

      enforcement: "not-applicable";

      reason: UncoveredReason;
    }
  | {
      decision: "block";

      enforcement: "enforced" | "unavailable";

      reason: BlockReason;

      rule: PolicyRule | null;

      limitUsd: number | null;

      message: string;
    };

// Why the context is missing. "Try again when you are online" is useless
// advice for a record that is corrupt on this device, and sends the user
// looking for a network problem that does not exist.
export type ContextUnavailableReason = "provider" | "local-record";

export type PolicyDecisionInput = {
  intent: PolicyIntent;

  policy: SecurityPolicy;

  context: PolicyContext | null;

  contextUnavailable?: ContextUnavailableReason;

  networkKind: NetworkKind;

  priceAvailability: PriceAvailability;
};

function formatUsd(value: number) {
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

const RULE_REASON: Record<PolicyRule, BlockReason> = {
  "max-single-transfer": "over-single-transfer",
  "new-recipient": "over-new-recipient",
  "daily-outflow": "over-daily-outflow",
};

function uncovered(reason: UncoveredReason): PolicyDecision {
  return {
    decision: "uncovered",

    enforcement: "not-applicable",

    reason,
  };
}

export function foldPolicyDecision<T>(
  decision: PolicyDecision,
  handlers: {
    allow: () => T;

    uncovered: (reason: UncoveredReason) => T;

    block: (blocked: Extract<PolicyDecision, { decision: "block" }>) => T;
  },
): T {
  switch (decision.decision) {
    case "allow":
      return handlers.allow();

    case "uncovered":
      return handlers.uncovered(decision.reason);

    case "block":
      return handlers.block(decision);
  }
}

export function toAmountUsd(
  amount: string | number,
  priceUsd: number | null,
): number | null {
  if (priceUsd === null || !Number.isFinite(priceUsd) || priceUsd <= 0) {
    return null;
  }

  const numeric = typeof amount === "number" ? amount : Number(amount);

  if (!Number.isFinite(numeric) || numeric < 0) {
    return null;
  }

  return numeric * priceUsd;
}

export function hasConfiguredLimits(policy: SecurityPolicy) {
  return (
    policy.maxSingleTransferUsd !== null ||
    policy.newRecipientMaxUsd !== null ||
    policy.dailyOutflowLimitUsd !== null
  );
}

function blocked(
  reason: BlockReason,
  message: string,
  limitUsd: number | null = null,
  enforcement: "enforced" | "unavailable" = "enforced",
): PolicyDecision {
  return {
    decision: "block",

    enforcement,

    reason,

    rule: null,

    limitUsd,

    message,
  };
}

function decideApproval(
  intent: Extract<PolicyIntent, { kind: "approval" }>,
  policy: SecurityPolicy,
  networkKind: NetworkKind,
): PolicyDecision {
  if (intent.revoking) {
    return uncovered("approval-revokes-access");
  }

  if (policy.blockUnlimitedApprovals && intent.unlimited) {
    return blocked(
      "approval-unlimited",
      "This would let that contract spend this token without any limit, for as long as the approval stands. Approve only the amount you are about to use.",
    );
  }

  if (policy.blockUnknownSpenders && !intent.spenderKnown) {
    return blocked(
      "approval-unknown-spender",
      "This contract is not one of the known ones this wallet recognises, so it cannot be given permission to move your tokens.",
    );
  }

  if (policy.maxApprovalExposureUsd === null) {
    return {
      decision: "allow",

      enforcement: "enforced",

      reason: "within-limits",
    };
  }

  if (networkKind === "testnet") {
    return uncovered("usd-policy-disabled-on-testnet");
  }

  if (intent.exposureUsd === null) {
    return blocked(
      "price-unavailable",
      "No price is available for this token, so the value you would be handing over cannot be checked. Turn off the approval limit if you want to approve it anyway.",
      policy.maxApprovalExposureUsd,
      "unavailable",
    );
  }

  if (intent.exposureUsd > policy.maxApprovalExposureUsd) {
    return blocked(
      "approval-over-exposure",
      `This approval puts ${formatUsd(
        intent.exposureUsd,
      )} of your tokens within that contract's reach. Your limit for a single approval is ${formatUsd(
        policy.maxApprovalExposureUsd,
      )}.`,
      policy.maxApprovalExposureUsd,
    );
  }

  return {
    decision: "allow",

    enforcement: "enforced",

    reason: "within-limits",
  };
}

function decideSwap(
  intent: Extract<PolicyIntent, { kind: "swap" }>,
  policy: SecurityPolicy,
  networkKind: NetworkKind,
  priceAvailability: PriceAvailability,
): PolicyDecision {
  if (policy.maxSwapLossUsd === null) {
    return {
      decision: "allow",

      enforcement: "enforced",

      reason: "within-limits",
    };
  }

  if (networkKind === "testnet") {
    return uncovered("usd-policy-disabled-on-testnet");
  }

  const lossUsd =
    priceAvailability === "available" ? intent.lossUsd : null;

  if (lossUsd === null || !Number.isFinite(lossUsd)) {
    return blocked(
      "price-unavailable",
      "One side of this swap has no price, so the worst case cannot be checked. Turn off the swap loss limit if you want to swap anyway.",
      policy.maxSwapLossUsd,
      "unavailable",
    );
  }

  if (lossUsd > policy.maxSwapLossUsd) {
    return blocked(
      "swap-over-loss",
      `In the worst case allowed by this quote you would end up ${formatUsd(
        lossUsd,
      )} down. Your limit is ${formatUsd(policy.maxSwapLossUsd)}.`,
      policy.maxSwapLossUsd,
    );
  }

  return {
    decision: "allow",

    enforcement: "enforced",

    reason: "within-limits",
  };
}

export function decidePolicy({
  intent,
  policy,
  context,
  contextUnavailable = "provider",
  networkKind,
  priceAvailability,
}: PolicyDecisionInput): PolicyDecision {
  // A policy we could not read is not a policy of no limits. Everything that
  // creates or increases exposure blocks until the user restores it; giving
  // permission back to a contract is the one thing still allowed through,
  // because refusing a revoke would only keep the user exposed.
  if (
    policy.availability === "unavailable" &&
    !(intent.kind === "approval" && intent.revoking)
  ) {
    return blocked(
      "policy-unavailable",

      "Your saved transaction limits could not be read, so this cannot be checked against them. Open Transaction limits, set them again, and try once more.",

      null,

      "unavailable",
    );
  }

  if (intent.kind === "approval") {
    return decideApproval(intent, policy, networkKind);
  }

  if (intent.kind === "swap") {
    return decideSwap(intent, policy, networkKind, priceAvailability);
  }

  if (!hasConfiguredLimits(policy)) {
    return uncovered("no-limits-configured");
  }

  if (networkKind === "testnet") {
    return uncovered("usd-policy-disabled-on-testnet");
  }

  if (context === null) {
    return {
      decision: "block",

      enforcement: "unavailable",

      reason: "history-unavailable",

      rule: null,

      limitUsd: null,

      message:
        contextUnavailable === "local-record"
          ? "Could not check your transaction limits: this device's own record of recent transactions cannot be read. Open Settings and repair local records."
          : "Could not check your transaction limits: wallet history is unavailable. Try again when you are online.",
    };
  }

  const amountUsd =
    priceAvailability === "available" ? intent.amountUsd : null;

  const verdict = evaluateSecurityPolicy(
    { recipient: intent.recipient, amountUsd },
    policy,
    context,
  );

  if (verdict.allowed) {
    return {
      decision: "allow",

      enforcement: "enforced",

      reason: "within-limits",
    };
  }

  const priceMissing = amountUsd === null || !Number.isFinite(amountUsd);

  return {
    decision: "block",

    enforcement: priceMissing ? "unavailable" : "enforced",

    reason: priceMissing ? "price-unavailable" : RULE_REASON[verdict.rule],

    rule: priceMissing ? null : verdict.rule,

    limitUsd: priceMissing ? null : verdict.limitUsd,

    message: verdict.message,
  };
}
