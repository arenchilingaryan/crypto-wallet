import {
  UNKNOWN,
  type NormalizedHoneypotFlag,
  type RiskReason,
} from "./types";

const CONTRACT_FLAG_PATTERN =
  /source|proxy|contract|owner|ownership|mint|self.?destruct|delegate|external.?call/i;

export function isContractHoneypotFlag(flag: NormalizedHoneypotFlag) {
  const searchable = `${flag.code} ${
    flag.description === UNKNOWN ? "" : flag.description
  }`;

  return CONTRACT_FLAG_PATTERN.test(searchable);
}

export function honeypotFlagLevel(
  flag: NormalizedHoneypotFlag,
): RiskReason["level"] {
  switch (flag.severity) {
    case "critical":
    case "high":
    case "medium":
      return flag.severity;
    case "info":
    case "low":
    case UNKNOWN:
      return "info";
  }
}

export function honeypotFlagMessage(flag: NormalizedHoneypotFlag) {
  if (flag.description !== UNKNOWN) {
    return flag.description;
  }

  return flag.code.replace(/[_-]+/g, " ");
}

export function honeypotFlagReasonCode(
  axis: "trade" | "contract",
  index: number,
  flag: NormalizedHoneypotFlag,
) {
  const normalizedCode = flag.code.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  return `honeypot-${axis}-flag-${index}-${normalizedCode}`;
}
