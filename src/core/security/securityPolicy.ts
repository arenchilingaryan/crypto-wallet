import type { Address } from "viem";

export type SecurityPolicy = {
  version: 1;

  maxSingleTransferUsd: number | null;

  newRecipientMaxUsd: number | null;

  dailyOutflowLimitUsd: number | null;

  maxApprovalExposureUsd: number | null;

  blockUnlimitedApprovals: boolean;

  blockUnknownSpenders: boolean;

  maxSwapLossUsd: number | null;
};

export const DEFAULT_SECURITY_POLICY: SecurityPolicy = {
  version: 1,

  maxSingleTransferUsd: null,

  newRecipientMaxUsd: null,

  dailyOutflowLimitUsd: null,

  maxApprovalExposureUsd: null,

  blockUnlimitedApprovals: true,

  blockUnknownSpenders: true,

  maxSwapLossUsd: null,
};

export type PolicyRule =
  | "max-single-transfer"
  | "new-recipient"
  | "daily-outflow";

export type PolicyRequest = {
  recipient: Address;

  amountUsd: number | null;
};

export type PolicyContext = {
  knownRecipients: string[];

  spentTodayUsd: number;
};

export type PolicyVerdict =
  | { allowed: true }
  | {
      allowed: false;

      rule: PolicyRule;

      limitUsd: number;

      message: string;
    };

function formatUsd(value: number) {
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

export function evaluateSecurityPolicy(
  request: PolicyRequest,
  policy: SecurityPolicy,
  context: PolicyContext,
): PolicyVerdict {
  const amountUsd = request.amountUsd;

  const hasLimits =
    policy.maxSingleTransferUsd !== null ||
    policy.newRecipientMaxUsd !== null ||
    policy.dailyOutflowLimitUsd !== null;

  if (amountUsd === null || !Number.isFinite(amountUsd)) {
    if (!hasLimits) {
      return { allowed: true };
    }

    return {
      allowed: false,

      rule: "max-single-transfer",

      limitUsd: policy.maxSingleTransferUsd ?? 0,

      message:
        "No price is available for this asset, so your limits cannot be checked. Disable the limits if you want to send it anyway.",
    };
  }

  if (
    policy.maxSingleTransferUsd !== null &&
    amountUsd > policy.maxSingleTransferUsd
  ) {
    return {
      allowed: false,

      rule: "max-single-transfer",

      limitUsd: policy.maxSingleTransferUsd,

      message: `This transfer is ${formatUsd(
        amountUsd,
      )}. Your policy allows at most ${formatUsd(
        policy.maxSingleTransferUsd,
      )} in a single transaction.`,
    };
  }

  const recipientIsKnown = context.knownRecipients.some(
    (address) => address.toLowerCase() === request.recipient.toLowerCase(),
  );

  if (
    !recipientIsKnown &&
    policy.newRecipientMaxUsd !== null &&
    amountUsd > policy.newRecipientMaxUsd
  ) {
    return {
      allowed: false,

      rule: "new-recipient",

      limitUsd: policy.newRecipientMaxUsd,

      message: `You have never sent to this address. Your policy allows at most ${formatUsd(
        policy.newRecipientMaxUsd,
      )} on a first transfer.`,
    };
  }

  if (policy.dailyOutflowLimitUsd !== null) {
    const total = context.spentTodayUsd + amountUsd;

    if (total > policy.dailyOutflowLimitUsd) {
      return {
        allowed: false,

        rule: "daily-outflow",

        limitUsd: policy.dailyOutflowLimitUsd,

        message: `This would bring today's outflow to ${formatUsd(
          total,
        )}. Your daily limit is ${formatUsd(policy.dailyOutflowLimitUsd)}.`,
      };
    }
  }

  return { allowed: true };
}

export function parseSecurityPolicy(raw: string | null): SecurityPolicy {
  if (!raw) {
    return DEFAULT_SECURITY_POLICY;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<SecurityPolicy>;

    if (parsed.version !== 1) {
      return DEFAULT_SECURITY_POLICY;
    }

    return {
      version: 1,

      maxSingleTransferUsd: normalizeLimit(parsed.maxSingleTransferUsd),

      newRecipientMaxUsd: normalizeLimit(parsed.newRecipientMaxUsd),

      dailyOutflowLimitUsd: normalizeLimit(parsed.dailyOutflowLimitUsd),

      maxApprovalExposureUsd: normalizeLimit(parsed.maxApprovalExposureUsd),

      blockUnlimitedApprovals: parsed.blockUnlimitedApprovals !== false,

      blockUnknownSpenders: parsed.blockUnknownSpenders !== false,

      maxSwapLossUsd: normalizeLimit(parsed.maxSwapLossUsd),
    };
  } catch {
    return DEFAULT_SECURITY_POLICY;
  }
}

export function serializeSecurityPolicy(policy: SecurityPolicy): string {
  return JSON.stringify(policy);
}

function normalizeLimit(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return value;
}
