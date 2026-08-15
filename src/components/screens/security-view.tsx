import { formatUnits } from "viem";

import { ActivityIndicator, Pressable, View } from "react-native";

import { AssetIcon } from "@/components/asset-icon";
import { Screen } from "@/components/ui/screen";
import { AppText } from "@/components/ui/text";
import { Button } from "@/components/ui/button";

import {
  describeRemaining,
  FREEZE_DURATION_MS,
  UNFREEZE_COOLDOWN_MS,
} from "@/core/security/panicFreeze";

import { Colors } from "@/constants/theme";

import type {
  ApprovalRisk,
  ApprovalScan,
  TokenApproval,
} from "@/core/blockchain/getApprovals";
import type {
  SecurityReviewState,
  SecurityReviewSummary,
} from "@/core/security/securityReviewSummary";

import { formatUsd, shortenAddress } from "@/utils/format";

import { styles } from "./security-view.styles";

type SecurityViewProps = {
  scan: ApprovalScan | null;

  review: SecurityReviewSummary | null;

  loading: boolean;

  error: string | null;

  onRevoke: (approval: TokenApproval) => void;

  onOpenSetup: () => void;

  freeze: {
    frozen: boolean;

    remainingMs: number;

    unfreezeRequested: boolean;

    unfreezeReadyInMs: number;
  };

  pinConfigured: boolean;

  onFreeze: () => void;

  onRequestUnfreeze: () => void;

  onCompleteUnfreeze: () => void;
};

function formatAllowance(approval: TokenApproval) {
  if (!approval.allowanceCertain) {
    return "Unknown";
  }

  if (approval.unlimited) {
    return "Unlimited";
  }

  // Without the token's real decimals any human-readable figure is arbitrary —
  // a 6-decimal token rendered as 18 understates the allowance a billionfold.
  if (!approval.decimalsCertain) {
    return "Amount unknown";
  }

  const value = Number(formatUnits(approval.allowance, approval.tokenDecimals));

  if (!Number.isFinite(value)) {
    return "—";
  }

  return `${value.toLocaleString("en-US", {
    maximumSignificantDigits: 6,
  })} ${approval.tokenSymbol}`;
}

function riskTone(risk: ApprovalRisk) {
  if (risk === "critical" || risk === "high") {
    return "danger" as const;
  }

  return risk === "medium" ? ("warning" as const) : ("muted" as const);
}

// The state carries the tone. "reviewed" and "neutral" are muted, never green —
// the screen has no vocabulary for a positive all-clear on purpose.
function reviewStateTone(state: SecurityReviewState) {
  if (state === "attention") {
    return "danger" as const;
  }

  if (state === "incomplete") {
    return "warning" as const;
  }

  return "muted" as const;
}

export function SecurityView({
  scan,
  review,
  loading,
  error,
  freeze,
  pinConfigured,
  onFreeze,
  onRequestUnfreeze,
  onCompleteUnfreeze,
  onRevoke,
  onOpenSetup,
}: SecurityViewProps) {
  const approvals = scan?.approvals ?? [];

  const totalExposure = scan?.totalExposureUsd ?? 0;

  // Taken straight from the review so the two can never drift apart: an unread
  // permission is a different kind of fact and is reported separately, never
  // added into one "risky" total.
  const riskyCount = review?.openItems.length ?? 0;

  // Only a permission whose allowance we actually read is proven to be active.
  const activeCount = approvals.filter(
    (approval) => approval.allowanceCertain,
  ).length;

  return (
    <Screen scroll>
      <AppText variant="title" tone="paper" style={styles.heading}>
        Security Review
      </AppText>

      {review && (
        <View style={styles.summary}>
          <AppText variant="bodyStrong" tone={reviewStateTone(review.state)}>
            {review.headline}
          </AppText>

          <AppText variant="caption" tone="muted">
            Reviewing {review.scope.join(", ").toLowerCase()} ·{" "}
            {review.reviewedPermissionCount} permission
            {review.reviewedPermissionCount === 1 ? "" : "s"} checked
          </AppText>

          {(review.openItems.length > 0 ||
            review.unverifiedPermissionCount > 0) && (
            <View style={styles.reviewGroup}>
              <AppText variant="overline" tone="muted">
                Permissions
              </AppText>

              {/* Counted side by side, never added together: a proven problem
                  and an unread permission are different kinds of fact. */}
              {review.openItems.length > 0 && (
                <AppText variant="caption" tone="danger">
                  {review.openItems.length} active issue
                  {review.openItems.length === 1 ? "" : "s"}
                </AppText>
              )}

              {review.unverifiedPermissionCount > 0 && (
                <AppText variant="caption" tone="warning">
                  {review.unverifiedPermissionCount} could not be verified
                </AppText>
              )}
            </View>
          )}

          {review.coverageGaps.length > 0 && (
            <View style={styles.reviewGroup}>
              <AppText variant="overline" tone="muted">
                Coverage
              </AppText>

              {review.coverageGaps.map((gap, index) => (
                <AppText key={index} variant="caption" tone="warning">
                  {gap.reason}
                </AppText>
              ))}
            </View>
          )}

          <View style={styles.reviewGroup}>
            <AppText variant="overline" tone="muted">
              Not included in this review
            </AppText>

            {review.notIncluded.map((boundary) => (
              <AppText key={boundary.area} variant="caption" tone="muted">
                {boundary.area} — {boundary.detail}
              </AppText>
            ))}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open security setup"
            onPress={onOpenSetup}
            style={({ pressed }) => [
              styles.setupLink,
              pressed && styles.revokeButtonPressed,
            ]}
          >
            <AppText variant="label">Security setup</AppText>

            <AppText variant="caption" tone="muted">
              PIN, spending limits and recovery phrase
            </AppText>
          </Pressable>
        </View>
      )}

      {freeze.frozen ? (
        <View style={styles.summary}>
          <AppText variant="overline" tone="danger">
            Locked down
          </AppText>

          <AppText variant="bodyStrong" tone="paper">
            Signing is blocked for another{" "}
            {describeRemaining(freeze.remainingMs)}
          </AppText>

          {!pinConfigured && (
            <AppText variant="caption" tone="muted">
              This wallet has no PIN, so there is no way to end the lockdown
              early. It clears itself when the time runs out.
            </AppText>
          )}

          {pinConfigured && !freeze.unfreezeRequested && (
            <>
              <AppText variant="caption" tone="muted">
                Nothing can be sent, swapped or approved until this clears on
                its own. To lift it sooner you have to ask now, wait out a
                cooldown, and confirm with your PIN a second time.
              </AppText>

              <Button
                title="Request unlock"
                variant="secondary"
                onPress={onRequestUnfreeze}
              />
            </>
          )}

          {pinConfigured &&
            freeze.unfreezeRequested &&
            freeze.unfreezeReadyInMs > 0 && (
              <AppText variant="caption" tone="muted">
                Early unlock opens in{" "}
                {describeRemaining(freeze.unfreezeReadyInMs)}. Come back then
                and enter your PIN again to finish it.
              </AppText>
            )}

          {pinConfigured &&
            freeze.unfreezeRequested &&
            freeze.unfreezeReadyInMs === 0 && (
              <>
                <AppText variant="caption" tone="muted">
                  The cooldown is over. Enter your PIN once more to unlock
                  signing.
                </AppText>

                <Button
                  title="Finish unlock"
                  variant="secondary"
                  onPress={onCompleteUnfreeze}
                />
              </>
            )}
        </View>
      ) : (
        <View style={styles.summary}>
          <AppText variant="overline" tone="muted">
            If your phone is out of your hands
          </AppText>

          <AppText variant="caption" tone="muted">
            Lockdown blocks every signature and the recovery phrase on this
            device, and clears itself after{" "}
            {describeRemaining(FREEZE_DURATION_MS)}. Unlocking sooner takes your
            PIN, a {describeRemaining(UNFREEZE_COOLDOWN_MS)} cooldown, and your
            PIN again, so it is not one tap away for whoever is holding the
            phone. Your coins stay where they are.
          </AppText>

          <AppText variant="caption" tone="muted">
            It buys time; it is not proof against someone who can change this
            device&apos;s clock, and your recovery phrase still works elsewhere.
          </AppText>

          <Button
            title="Lock down signing"
            variant="secondary"
            onPress={onFreeze}
          />
        </View>
      )}

      {approvals.length > 0 && (
        <View style={styles.summary}>
          <AppText variant="overline" tone="muted">
            Maximum blast radius
          </AppText>

          <AppText variant="title" tone="paper" tabular>
            {formatUsd(totalExposure)}
          </AppText>

          <AppText variant="caption" tone={riskyCount > 0 ? "danger" : "muted"}>
            {activeCount} active permission
            {activeCount === 1 ? "" : "s"}
            {riskyCount > 0 ? ` · ${riskyCount} risky` : ""}
          </AppText>

          {review !== null && review.unvaluedPermissionCount > 0 && (
            <AppText variant="caption" tone="warning">
              {review.unvaluedPermissionCount} permission
              {review.unvaluedPermissionCount === 1 ? "" : "s"} carry no dollar
              figure and are not counted here. Their value is unknown, not zero.
            </AppText>
          )}

          <AppText variant="caption" tone="muted">
            The most these contracts could take from your current balances,
            counting a Permit2 budget as spendable because one signature
            releases it. Each balance is counted once, however many contracts
            can reach it.
          </AppText>
        </View>
      )}

      {loading && (
        <View style={styles.state}>
          <ActivityIndicator color={Colors.textSecondary} />
        </View>
      )}

      {error && (
        <View style={styles.state}>
          <AppText variant="bodyStrong" tone="danger">
            {error}
          </AppText>
        </View>
      )}

      {!loading && !error && approvals.length === 0 && (
        <View style={styles.state}>
          <AppText variant="bodyStrong">
            {scan?.coverage === "partial"
              ? "No approvals confirmed yet"
              : "No active approvals"}
          </AppText>

          <AppText variant="caption" tone="muted">
            {scan?.coverage === "partial"
              ? "Nothing turned up in the history we could read, but that read was incomplete — this is not a guarantee that none exist."
              : "None of the checked contracts can move your tokens."}
          </AppText>
        </View>
      )}

      <View style={styles.list}>
        {approvals.map((approval) => (
          <View key={approval.id} style={styles.approval}>
            <View style={styles.approvalTop}>
              <AssetIcon
                symbol={approval.tokenSymbol}
                logo={approval.tokenLogo}
                type="erc20"
                size={40}
              />

              <View style={styles.approvalIdentity}>
                <View style={styles.approvalTitle}>
                  <AppText variant="bodyStrong">{approval.tokenSymbol}</AppText>

                  <View style={styles.riskBadge}>
                    <AppText variant="caption" tone={riskTone(approval.risk)}>
                      {approval.risk.toUpperCase()}
                    </AppText>
                  </View>
                </View>

                <AppText variant="caption" tone="muted" numberOfLines={1}>
                  {approval.spenderName}
                </AppText>
              </View>

              <View style={styles.approvalAmounts}>
                <AppText
                  variant="bodyStrong"
                  tone={
                    !approval.allowanceCertain
                      ? "danger"
                      : approval.unlimited
                        ? "warning"
                        : // An amount we could not scale is not a confirmed
                          // number and must not be styled like one.
                          !approval.decimalsCertain
                          ? "warning"
                          : "primary"
                  }
                  tabular
                >
                  {formatAllowance(approval)}
                </AppText>

                {!approval.allowanceCertain ? (
                  <AppText variant="caption" tone="muted" tabular>
                    allowance could not be read
                  </AppText>
                ) : approval.exposureUsd !== null ? (
                  <>
                    <AppText variant="caption" tone="muted" tabular>
                      {formatUsd(approval.exposureUsd)} at risk
                    </AppText>

                    {/* The figure rests on a read that failed — say so next to
                        it rather than letting it look confirmed. */}
                    {!approval.exposureCertain && (
                      <AppText variant="caption" tone="warning">
                        not fully confirmed
                      </AppText>
                    )}
                  </>
                ) : (
                  // Never leave this blank: an amount we could not work out must
                  // say so, or its absence reads as "nothing at stake".
                  <AppText variant="caption" tone="warning">
                    Exposure could not be determined
                  </AppText>
                )}
              </View>
            </View>

            <View style={styles.approvalDetails}>
              <View style={styles.detailRow}>
                <AppText variant="caption" tone="muted">
                  Channel
                </AppText>

                <AppText variant="caption" tone="secondary">
                  {approval.channel === "permit2"
                    ? "Permit2 permission"
                    : "Direct approval"}
                </AppText>
              </View>

              {approval.expiresAt !== null && (
                <View style={styles.detailRow}>
                  <AppText variant="caption" tone="muted">
                    Expires
                  </AppText>

                  <AppText variant="caption" tone="secondary">
                    {new Date(approval.expiresAt * 1000).toLocaleDateString()}
                  </AppText>
                </View>
              )}

              <View style={styles.detailRow}>
                <AppText variant="caption" tone="muted">
                  Purpose
                </AppText>

                <AppText variant="caption" tone="secondary">
                  {approval.spenderPurpose}
                </AppText>
              </View>

              <View style={styles.detailRow}>
                <AppText variant="caption" tone="muted">
                  Spender
                </AppText>

                <AppText variant="caption" tone="accent" mono>
                  {shortenAddress(approval.spender)}
                </AppText>
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Revoke ${approval.tokenSymbol} approval for ${approval.spenderName}`}
              onPress={() => onRevoke(approval)}
              style={({ pressed }) => [
                styles.revokeButton,
                pressed && styles.revokeButtonPressed,
              ]}
            >
              <AppText variant="label" tone="danger">
                Revoke
              </AppText>
            </Pressable>
          </View>
        ))}
      </View>

      <View style={styles.footer} />
    </Screen>
  );
}
