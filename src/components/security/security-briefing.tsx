import { View } from "react-native";

import { AppText } from "@/components/ui/text";

import type {
  ReviewCheck,
  ReviewStatus,
  SecurityReview,
} from "@/core/security/securityReview";

import { styles } from "./security-briefing.styles";

const MARK: Record<ReviewStatus, string> = {
  pass: "✓",
  attention: "!",
  blocked: "✕",
  unchecked: "–",
};

const TONE: Record<ReviewStatus, "success" | "warning" | "danger" | "muted"> = {
  pass: "success",
  attention: "warning",
  blocked: "danger",
  unchecked: "muted",
};

function Check({ check }: { check: ReviewCheck }) {
  return (
    <View style={styles.check}>
      <AppText variant="bodyStrong" tone={TONE[check.status]} style={styles.mark}>
        {MARK[check.status]}
      </AppText>

      <View style={styles.checkText}>
        <AppText
          variant="body"
          tone={check.status === "blocked" ? "danger" : "primary"}
        >
          {check.title}
        </AppText>

        {check.detail && (
          <AppText variant="caption" tone="muted">
            {check.detail}
          </AppText>
        )}
      </View>
    </View>
  );
}

export function SecurityBriefing({ review }: { review: SecurityReview }) {
  const blocked = review.decision.decision === "block";

  return (
    <View style={[styles.card, blocked && styles.blockedCard]}>
      {review.checks.map((check) => (
        <Check key={check.id} check={check} />
      ))}
    </View>
  );
}
