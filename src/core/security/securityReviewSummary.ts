import type { ApprovalScan, ApprovalRisk } from "@/core/blockchain/getApprovals";

// Security Review v1 — an honest aggregation of ALREADY-COMPUTED Permission
// Graph facts. Deliberately narrow: it reviews permission exposure only.
//
// Design invariants (why this file is careful, not clever):
//   - No score, no global "SAFE/GOOD". The top state is a finite automaton over
//     three separate epistemic buckets, never a number.
//   - `kind` is a DATA field, not a colour. A finding (a proven active risk) and
//     an unverified area (something we could not check) can never be summed or
//     styled into each other. There is no cross-cutting "N problems" total.
//   - Coverage gaps are scoped to THIS review's sources only. Token and
//     recipient checks are out of scope and are surfaced as explicit "not
//     included" boundaries — they must NOT push the state to "incomplete", or a
//     fully-verified permission scan would lie about being unfinished.
//   - "Reviewed" never claims the wallet is safe, only that no issue was found
//     in the checks actually performed.

export type SecurityReviewState =
  | "neutral"
  | "incomplete"
  | "attention"
  | "reviewed";

export type SecurityReviewFinding = {
  kind: "finding";

  source: "permissions";

  severity: ApprovalRisk;

  subjectRef: string;

  tokenSymbol: string;

  spenderName: string;

  // Raw signals; the UI formats the label. `exposureUsd === null` means the
  // exposure could not be determined — which is itself worth attention, so it
  // ranks ABOVE any finite dollar amount rather than sorting as zero.
  exposureUsd: number | null;

  unlimited: boolean;

  action: "revoke";
};

export type SecurityReviewGap = {
  kind: "unverified";

  source: "permissions";

  reason: string;
};

// The atom of the review: one fact, discriminated by `kind`. Callers that show
// both buckets together branch on `kind` rather than on styling.
export type SecurityReviewItem = SecurityReviewFinding | SecurityReviewGap;

export function isFinding(
  item: SecurityReviewItem,
): item is SecurityReviewFinding {
  return item.kind === "finding";
}

export type SecurityReviewBoundary = {
  area: string;

  detail: string;
};

export type SecurityReviewSummary = {
  state: SecurityReviewState;

  headline: string;

  scope: string[];

  openItems: SecurityReviewFinding[];

  coverageGaps: SecurityReviewGap[];

  notIncluded: SecurityReviewBoundary[];

  // Context, not a verdict: how many active permissions were actually read.
  reviewedPermissionCount: number;

  // Permissions whose current allowance could not be read. Reported next to the
  // findings count but never added to it — a proven problem and an unread one
  // are different kinds of fact and must not be summed into one total.
  unverifiedPermissionCount: number;

  // Permissions that carry no dollar figure at all — either the allowance could
  // not be read or the token could not be valued — and therefore contribute
  // nothing to the exposure total. Stated so a headline sum is never mistaken
  // for the whole picture. No direction is claimed: their true value is
  // unknown, not necessarily larger.
  unvaluedPermissionCount: number;
};

const SEVERITY_RANK: Record<ApprovalRisk, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const HEADLINE: Record<SecurityReviewState, string> = {
  neutral: "Nothing to review yet",

  incomplete: "Checks incomplete",

  attention: "Items need attention",

  // Never "secure" / "all good": the claim is bounded to what was checked.
  reviewed: "No issues found in the checks performed",
};

// The two things beyond a permission scan that a full wallet review would also
// cover. Named explicitly so their absence is honest, not silent — but kept out
// of the state machine so they cannot make an in-scope-complete review read as
// unfinished.
// Direct approvals are discovered from the wallet's own history, so that side is
// searched in full. Permit2 sub-spenders are not discovered — they are probed
// from a fixed list of routers, and on a network with no such list the channel
// is not examined at all. That is a standing property of the check, not a
// transient failure: it can never be resolved by retrying, so it belongs with
// the boundaries rather than driving the state to "incomplete" forever.
function boundariesFor(permit2SpendersChecked: number) {
  return [
    { area: "Token risk", detail: "not included in this review" },

    { area: "Recipient history", detail: "not included in this review" },

    permit2SpendersChecked === 0
      ? {
          area: "Permit2 spenders",
          detail: "not checked on this network",
        }
      : {
          area: "Permit2 spenders",
          detail: "only known routers are checked, not discovered",
        },
  ];
}

export function buildSecurityReview(scan: ApprovalScan): SecurityReviewSummary {
  const openItems: SecurityReviewFinding[] = scan.approvals
    .filter(
      (approval) =>
        approval.allowanceCertain &&
        (approval.risk === "critical" || approval.risk === "high"),
    )
    .map((approval) => ({
      kind: "finding" as const,

      source: "permissions" as const,

      severity: approval.risk,

      subjectRef: approval.id,

      tokenSymbol: approval.tokenSymbol,

      spenderName: approval.spenderName,

      exposureUsd: approval.exposureUsd,

      unlimited: approval.unlimited,

      action: "revoke" as const,
    }));

  openItems.sort((a, b) => {
    if (SEVERITY_RANK[a.severity] !== SEVERITY_RANK[b.severity]) {
      return SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    }

    const aUnknown = a.exposureUsd === null;

    const bUnknown = b.exposureUsd === null;

    // Undeterminable exposure ranks above any finite amount — it cannot be
    // honestly compared by size, so it is never buried beneath one.
    if (aUnknown !== bUnknown) {
      return aUnknown ? -1 : 1;
    }

    return (b.exposureUsd ?? 0) - (a.exposureUsd ?? 0);
  });

  const coverageGaps: SecurityReviewGap[] = [];

  if (scan.coverage === "partial") {
    coverageGaps.push({
      kind: "unverified",

      source: "permissions",

      reason:
        "Permission history is partial — some past approvals could not be read.",
    });
  }

  const unreadable = scan.approvals.filter(
    (approval) => !approval.allowanceCertain,
  ).length;

  if (unreadable > 0) {
    coverageGaps.push({
      kind: "unverified",

      source: "permissions",

      reason: `${unreadable} permission${
        unreadable === 1 ? "" : "s"
      } could not be verified — treat as unknown, not safe.`,
    });
  }

  // A Permit2 budget probe that failed is a read that did not happen. Take the
  // signal straight from the scan rather than inferring it from whether a row
  // ended up with a number: an unpriced token hides the same failure behind a
  // null exposure, and inferring from `exposureCertain` alone would also drag
  // every merely-unpriced token into "incomplete" forever.
  if (scan.unreadBudgetCount > 0) {
    coverageGaps.push({
      kind: "unverified",

      source: "permissions",

      reason: `The Permit2 budget for ${scan.unreadBudgetCount} token${
        scan.unreadBudgetCount === 1 ? "" : "s"
      } could not be read, so any figure that depends on it is unconfirmed.`,
    });
  }

  if (scan.unreadPermit2Count > 0) {
    coverageGaps.push({
      kind: "unverified",

      source: "permissions",

      reason: `Permit2 permissions for ${scan.unreadPermit2Count} token${
        scan.unreadPermit2Count === 1 ? "" : "s"
      } could not be read, so which contracts can pull those budgets is unknown.`,
    });
  }

  if (scan.checkedSpenders === 0 && scan.checkedTokens > 0) {
    coverageGaps.push({
      kind: "unverified",

      source: "permissions",

      reason:
        "No spenders could be checked on this network, so no permission was actually verified.",
    });
  }

  const reviewedPermissionCount = scan.approvals.filter(
    (approval) => approval.allowanceCertain,
  ).length;

  const hasSubjects = scan.approvals.length > 0 || scan.checkedTokens > 0;

  // Coverage gates the headline: an incomplete in-scope check is reported as
  // incomplete even when findings exist, so "0 found" can never read as clean.
  // An empty wallet is "nothing to review", never a green "all clear".
  let state: SecurityReviewState;

  // A gap outranks emptiness. "Nothing to review yet" is itself a claim — that
  // we looked and there was nothing — so it may only be made when the looking
  // actually succeeded. An empty wallet whose history could not be read is an
  // unfinished check, not an established absence.
  if (coverageGaps.length > 0) {
    state = "incomplete";
  } else if (!hasSubjects) {
    state = "neutral";
  } else if (openItems.length > 0) {
    state = "attention";
  } else {
    state = "reviewed";
  }

  return {
    state,

    headline: HEADLINE[state],

    scope: ["Permission exposure"],

    openItems,

    coverageGaps,

    notIncluded: boundariesFor(scan.permit2SpendersChecked),

    reviewedPermissionCount,

    unverifiedPermissionCount: unreadable,

    unvaluedPermissionCount: scan.approvals.filter(
      (approval) => !approval.allowanceCertain || approval.exposureUsd === null,
    ).length,
  };
}
