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

import { formatUsd, shortenAddress } from "@/utils/format";

import { styles } from "./security-view.styles";

type SecurityViewProps = {
  scan: ApprovalScan | null;

  loading: boolean;

  error: string | null;

  onRevoke: (approval: TokenApproval) => void;

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
  if (approval.unlimited) {
    return "Unlimited";
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

export function SecurityView({
  scan,
  loading,
  error,
  freeze,
  pinConfigured,
  onFreeze,
  onRequestUnfreeze,
  onCompleteUnfreeze,
  onRevoke,
}: SecurityViewProps) {
  const approvals = scan?.approvals ?? [];

  const totalExposure = scan?.totalExposureUsd ?? 0;

  const riskyCount = approvals.filter(
    (approval) => approval.risk === "critical" || approval.risk === "high",
  ).length;

  return (
    <Screen scroll>
      <AppText variant="title" tone="paper" style={styles.heading}>
        Security
      </AppText>

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

      <AppText variant="caption" tone="muted" style={styles.notice}>
        {scan
          ? `Checked ${scan.checkedTokens} token${
              scan.checkedTokens === 1 ? "" : "s"
            } against ${scan.checkedSpenders} known spenders, direct and via Permit2.` +
            (scan.expiredCount > 0
              ? ` ${scan.expiredCount} expired permission${
                  scan.expiredCount === 1 ? "" : "s"
                } ignored.`
              : "") +
            (scan.uncertainCount > 0
              ? ` ${scan.uncertainCount} permission${
                  scan.uncertainCount === 1 ? " is" : "s are"
                } shown without a dollar figure: its limit or price could not be read, so treat the amount as unknown rather than small.`
              : "") +
            " Permissions to contracts outside this list are not shown."
          : "Approvals let a contract move your tokens until you revoke them."}
      </AppText>

      {approvals.length > 0 && (
        <View style={styles.summary}>
          <AppText variant="overline" tone="muted">
            Maximum blast radius
          </AppText>

          <AppText variant="title" tone="paper" tabular>
            {formatUsd(totalExposure)}
          </AppText>

          <AppText variant="caption" tone={riskyCount > 0 ? "danger" : "muted"}>
            {approvals.length} active permission
            {approvals.length === 1 ? "" : "s"}
            {riskyCount > 0 ? ` · ${riskyCount} risky` : ""}
          </AppText>

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
          <AppText variant="bodyStrong">No active approvals</AppText>

          <AppText variant="caption" tone="muted">
            None of the checked contracts can move your tokens.
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
                  tone={approval.unlimited ? "warning" : "primary"}
                  tabular
                >
                  {formatAllowance(approval)}
                </AppText>

                {approval.exposureUsd !== null && (
                  <AppText variant="caption" tone="muted" tabular>
                    {formatUsd(approval.exposureUsd)} at risk
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
