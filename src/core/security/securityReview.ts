import type { Address } from "viem";

import {
  decidePolicy,
  type ContextUnavailableReason,
  type NetworkKind,
  type PolicyDecision,
  type PriceAvailability,
} from "./policyDecision";

import type { PolicyContext, SecurityPolicy } from "./securityPolicy";

export type ReviewStatus = "pass" | "attention" | "blocked" | "unchecked";

export type ReviewCheck = {
  id: string;

  status: ReviewStatus;

  title: string;

  detail: string | null;
};

export type SecurityReview = {
  decision: PolicyDecision;

  checks: ReviewCheck[];
};

function formatUsd(value: number) {
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function check(
  id: string,
  status: ReviewStatus,
  title: string,
  detail: string | null = null,
): ReviewCheck {
  return { id, status, title, detail };
}

function blockedBy(decision: PolicyDecision, reason: string) {
  return decision.decision === "block" && decision.reason === reason;
}

// Facts about the transfer itself. They stay true whether or not the saved
// policy could be read, so they are shown on both paths.
function transferShapeChecks(recipientIsContract: boolean | null): ReviewCheck[] {
  const checks: ReviewCheck[] = [
    check(
      "ongoing-permission",
      "pass",
      "This grants no ongoing permission",
      "It moves this amount once. Nothing can be spent from your wallet later because of it.",
    ),
  ];

  if (recipientIsContract === true) {
    checks.push(
      check(
        "recipient-is-contract",
        "attention",
        "The recipient is a contract, not a wallet",
        "Tokens sent to a contract that does not expect them cannot be recovered.",
      ),
    );
  } else if (recipientIsContract === null) {
    checks.push(
      check(
        "recipient-is-contract",
        "unchecked",
        "Could not tell whether the recipient is a contract",
      ),
    );
  }

  return checks;
}

// Every dollar rule is unknowable while the stored policy cannot be read.
// Rendering the usual "you have not set one" lines here would report a storage
// fault as the user's own choice.
function unreadableLimitsCheck(decision: PolicyDecision): ReviewCheck {
  return check(
    "limits-readable",
    "blocked",
    "Your saved limits could not be read",
    decision.decision === "block" ? decision.message : null,
  );
}

function limitsOffOnTestnet(decision: PolicyDecision) {
  return (
    decision.decision === "uncovered" &&
    decision.reason === "usd-policy-disabled-on-testnet"
  );
}

function sealReview(
  decision: PolicyDecision,
  checks: ReviewCheck[],
): SecurityReview {
  if (
    decision.decision === "block" &&
    !checks.some((item) => item.status === "blocked")
  ) {
    return {
      decision,

      checks: [
        ...checks,

        check("policy-block", "blocked", "This wallet refuses to sign this", decision.message),
      ],
    };
  }

  return { decision, checks };
}

export type TransferReviewInput = {
  recipient: Address;

  symbol: string;

  amount: string;

  amountUsd: number | null;

  recipientIsContract: boolean | null;

  policy: SecurityPolicy;

  context: PolicyContext | null;

  contextUnavailable?: ContextUnavailableReason;

  networkKind: NetworkKind;

  priceAvailability: PriceAvailability;
};

export function reviewTransfer(input: TransferReviewInput): SecurityReview {
  const decision = decidePolicy({
    intent: {
      kind: "transfer",
      recipient: input.recipient,
      amountUsd: input.amountUsd,
    },

    policy: input.policy,

    context: input.context,

    contextUnavailable: input.contextUnavailable,

    networkKind: input.networkKind,

    priceAvailability: input.priceAvailability,
  });

  const checks: ReviewCheck[] = [];

  const recipientKnown =
    input.context?.knownRecipients.some(
      (address) => address.toLowerCase() === input.recipient.toLowerCase(),
    ) ?? null;

  if (blockedBy(decision, "history-unavailable")) {
    checks.push(
      check(
        "recipient-history",
        "blocked",
        "Could not check this recipient",
        decision.decision === "block" ? decision.message : null,
      ),
    );
  } else if (recipientKnown === null) {
    checks.push(
      check(
        "recipient-history",
        "unchecked",
        "Recipient history not read",
        "This wallet could not look at who you have sent to before.",
      ),
    );
  } else if (recipientKnown) {
    checks.push(
      check(
        "recipient-history",
        "pass",
        "You have sent to this address before",
      ),
    );
  } else {
    checks.push(
      check(
        "recipient-history",
        "attention",
        "First time you send to this address",
        "Check the address against the source you copied it from.",
      ),
    );
  }

  if (blockedBy(decision, "policy-unavailable")) {
    return sealReview(decision, [
      ...checks,

      unreadableLimitsCheck(decision),

      ...transferShapeChecks(input.recipientIsContract),
    ]);
  }

  const singleLimit = input.policy.maxSingleTransferUsd;

  if (blockedBy(decision, "over-single-transfer")) {
    checks.push(
      check(
        "single-transfer-limit",
        "blocked",
        "Over your single-transfer limit",
        decision.decision === "block" ? decision.message : null,
      ),
    );
  } else if (singleLimit === null) {
    checks.push(
      check(
        "single-transfer-limit",
        "unchecked",
        "No limit on a single transfer",
        "You have not set one, so nothing caps this amount.",
      ),
    );
  } else if (limitsOffOnTestnet(decision)) {
    checks.push(
      check(
        "single-transfer-limit",
        "unchecked",
        "Dollar limits are off on a test network",
        "Test coins have no price, so your limits cannot be applied here.",
      ),
    );
  } else if (input.amountUsd === null) {
    checks.push(
      check(
        "single-transfer-limit",
        "unchecked",
        `No price for ${input.symbol}`,
        "Your limit could not be applied to an amount that cannot be valued.",
      ),
    );
  } else {
    checks.push(
      input.amountUsd > singleLimit
        ? check(
            "single-transfer-limit",
            "attention",
            `Over your ${formatUsd(singleLimit)} limit`,
            `This transfer is ${formatUsd(input.amountUsd)}. Another rule refused it first, so this one was never applied.`,
          )
        : check(
            "single-transfer-limit",
            "pass",
            `Within your ${formatUsd(singleLimit)} limit`,
            `This transfer is ${formatUsd(input.amountUsd)}.`,
          ),
    );
  }

  const newRecipientLimit = input.policy.newRecipientMaxUsd;

  if (blockedBy(decision, "over-new-recipient")) {
    checks.push(
      check(
        "new-recipient-limit",
        "blocked",
        "Over your limit for a first transfer",
        decision.decision === "block" ? decision.message : null,
      ),
    );
  } else if (
    newRecipientLimit !== null &&
    recipientKnown === false &&
    input.amountUsd !== null &&
    !limitsOffOnTestnet(decision)
  ) {
    checks.push(
      input.amountUsd > newRecipientLimit
        ? check(
            "new-recipient-limit",
            "attention",
            `Over your ${formatUsd(newRecipientLimit)} first-transfer limit`,
            "Another rule refused this transfer first, so this one was never applied.",
          )
        : check(
            "new-recipient-limit",
            "pass",
            `Within your ${formatUsd(newRecipientLimit)} first-transfer limit`,
          ),
    );
  }

  const dailyLimit = input.policy.dailyOutflowLimitUsd;

  if (blockedBy(decision, "over-daily-outflow")) {
    checks.push(
      check(
        "daily-outflow",
        "blocked",
        "Over your daily limit",
        decision.decision === "block" ? decision.message : null,
      ),
    );
  } else if (
    dailyLimit !== null &&
    input.context !== null &&
    input.amountUsd !== null &&
    !limitsOffOnTestnet(decision)
  ) {
    const dayTotal = input.context.spentTodayUsd + input.amountUsd;

    checks.push(
      dayTotal > dailyLimit
        ? check(
            "daily-outflow",
            "attention",
            `Over your ${formatUsd(dailyLimit)} daily limit`,
            `${formatUsd(dayTotal)} including this transfer. Another rule refused it first, so this one was never applied.`,
          )
        : check(
            "daily-outflow",
            "pass",
            `Within your ${formatUsd(dailyLimit)} daily limit`,
            `${formatUsd(dayTotal)} including this transfer.`,
          ),
    );
  }

  if (blockedBy(decision, "price-unavailable")) {
    checks.push(
      check(
        "price-available",
        "blocked",
        "No price, so your limits cannot be checked",
        decision.decision === "block" ? decision.message : null,
      ),
    );
  }

  checks.push(...transferShapeChecks(input.recipientIsContract));

  return sealReview(decision, checks);
}

export type ApprovalReviewInput = {
  spender: Address;

  spenderName: string | null;

  spenderKnown: boolean;

  token: string;

  allowanceLabel: string;

  unlimited: boolean;

  revoking: boolean;

  exposureUsd: number | null;

  policy: SecurityPolicy;

  networkKind: NetworkKind;
};

export function reviewApproval(input: ApprovalReviewInput): SecurityReview {
  const decision = decidePolicy({
    intent: {
      kind: "approval",
      spender: input.spender,
      spenderKnown: input.spenderKnown,
      unlimited: input.unlimited,
      revoking: input.revoking,
      exposureUsd: input.exposureUsd,
    },

    policy: input.policy,

    context: null,

    networkKind: input.networkKind,

    priceAvailability:
      input.exposureUsd === null ? "unavailable" : "available",
  });

  const checks: ReviewCheck[] = [];

  if (input.revoking) {
    checks.push(
      check(
        "approval-revoke",
        "pass",
        "This takes access away",
        `${input.spenderName ?? "This contract"} will no longer be able to move your ${input.token}.`,
      ),
    );

    return sealReview(decision, checks);
  }

  if (blockedBy(decision, "policy-unavailable")) {
    checks.push(unreadableLimitsCheck(decision));
  }

  if (blockedBy(decision, "approval-unknown-spender")) {
    checks.push(
      check(
        "spender-known",
        "blocked",
        "This wallet does not recognise this contract",
        decision.decision === "block" ? decision.message : null,
      ),
    );
  } else if (input.spenderKnown) {
    checks.push(
      check(
        "spender-known",
        "pass",
        `Known contract: ${input.spenderName ?? "recognised by this wallet"}`,
      ),
    );
  } else {
    checks.push(
      check(
        "spender-known",
        "attention",
        "This contract is not one this wallet knows",
        "Only continue if you know exactly what it is.",
      ),
    );
  }

  if (blockedBy(decision, "approval-unlimited")) {
    checks.push(
      check(
        "approval-bounded",
        "blocked",
        "Unlimited access refused",
        decision.decision === "block" ? decision.message : null,
      ),
    );
  } else if (input.unlimited) {
    checks.push(
      check(
        "approval-bounded",
        "attention",
        "Unlimited access",
        `This contract could move your ${input.token} again at any time, without asking.`,
      ),
    );
  } else {
    checks.push(
      check(
        "approval-bounded",
        "pass",
        `Capped at ${input.allowanceLabel}`,
        "Anything beyond that needs your approval again.",
      ),
    );
  }

  if (
    blockedBy(decision, "approval-over-exposure") ||
    blockedBy(decision, "price-unavailable")
  ) {
    checks.push(
      check(
        "approval-exposure",
        "blocked",
        "Over your approval limit",
        decision.decision === "block" ? decision.message : null,
      ),
    );
  } else if (input.exposureUsd !== null) {
    checks.push(
      check(
        "approval-exposure",
        "pass",
        `At most ${formatUsd(input.exposureUsd)} is exposed`,
        "That is the most this approval can put within reach.",
      ),
    );
  }

  return sealReview(decision, checks);
}

export type SwapReviewInput = {
  symbolIn: string;

  symbolOut: string;

  amountIn: string;

  minAmountOut: string;

  slippagePercent: string;

  deadlineMinutes: number;

  routerKnown: boolean;

  routeLabel: string;

  lossUsd: number | null;

  policy: SecurityPolicy;

  networkKind: NetworkKind;
};

export function reviewSwap(input: SwapReviewInput): SecurityReview {
  const decision = decidePolicy({
    intent: { kind: "swap", lossUsd: input.lossUsd },

    policy: input.policy,

    context: null,

    networkKind: input.networkKind,

    priceAvailability: input.lossUsd === null ? "unavailable" : "available",
  });

  const checks: ReviewCheck[] = [
    check(
      "swap-minimum",
      "pass",
      `You receive at least ${input.minAmountOut} ${input.symbolOut}`,
      `Below that the swap reverts and you keep your ${input.symbolIn}.`,
    ),

    check(
      "swap-deadline",
      "pass",
      `Expires in ${input.deadlineMinutes} minutes`,
      "After that this transaction can no longer be executed.",
    ),

    input.routerKnown
      ? check("swap-router", "pass", `Route: ${input.routeLabel}`)
      : check(
          "swap-router",
          "attention",
          "Unrecognised router",
          "This wallet cannot confirm which contract would execute the swap.",
        ),
  ];

  if (blockedBy(decision, "policy-unavailable")) {
    checks.push(unreadableLimitsCheck(decision));
  }

  if (blockedBy(decision, "swap-over-loss")) {
    checks.push(
      check(
        "swap-worst-case",
        "blocked",
        "Worst case is over your swap loss limit",
        decision.decision === "block" ? decision.message : null,
      ),
    );
  } else if (blockedBy(decision, "price-unavailable")) {
    checks.push(
      check(
        "swap-worst-case",
        "blocked",
        "No price, so the worst case cannot be checked",
        decision.decision === "block" ? decision.message : null,
      ),
    );
  } else if (input.lossUsd !== null) {
    checks.push(
      check(
        "swap-worst-case",
        "pass",
        `Worst case costs you ${formatUsd(input.lossUsd)}`,
        "Measured against the minimum you would receive.",
      ),
    );
  }

  return sealReview(decision, checks);
}

export function reviewBlocks(review: SecurityReview) {
  return review.decision.decision === "block";
}

export function worstStatus(review: SecurityReview): ReviewStatus {
  if (review.checks.some((item) => item.status === "blocked")) {
    return "blocked";
  }

  if (review.checks.some((item) => item.status === "attention")) {
    return "attention";
  }

  if (review.checks.some((item) => item.status === "unchecked")) {
    return "unchecked";
  }

  return "pass";
}
