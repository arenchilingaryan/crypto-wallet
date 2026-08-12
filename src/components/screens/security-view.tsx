import { formatUnits } from "viem";

import { ActivityIndicator, Pressable, View } from "react-native";

import { AssetIcon } from "@/components/asset-icon";
import { Screen } from "@/components/ui/screen";
import { AppText } from "@/components/ui/text";

import { Colors } from "@/constants/theme";

import type { ApprovalScan, TokenApproval } from "@/core/blockchain/getApprovals";

import { formatUsd, shortenAddress } from "@/utils/format";

import { styles } from "./security-view.styles";

type SecurityViewProps = {
  scan: ApprovalScan | null;

  loading: boolean;

  error: string | null;

  onRevoke: (approval: TokenApproval) => void;
};

function formatAllowance(approval: TokenApproval) {
  if (approval.unlimited) {
    return "Unlimited";
  }

  const value = Number(
    formatUnits(approval.allowance, approval.tokenDecimals),
  );

  if (!Number.isFinite(value)) {
    return "—";
  }

  return `${value.toLocaleString("en-US", {
    maximumSignificantDigits: 6,
  })} ${approval.tokenSymbol}`;
}

export function SecurityView({
  scan,
  loading,
  error,
  onRevoke,
}: SecurityViewProps) {
  const approvals = scan?.approvals ?? [];

  const totalExposure = approvals.reduce(
    (total, approval) => total + (approval.exposureUsd ?? 0),
    0,
  );

  const unlimitedCount = approvals.filter(
    (approval) => approval.unlimited,
  ).length;

  return (
    <Screen scroll>
      <AppText variant="title" tone="paper" style={styles.heading}>
        Security
      </AppText>

      {/* Покрытие названо прямо: пусто здесь — «среди проверенных нет». */}
      <AppText variant="caption" tone="muted" style={styles.notice}>
        {scan
          ? `Checked ${scan.checkedTokens} token${
              scan.checkedTokens === 1 ? "" : "s"
            } against ${scan.checkedSpenders} known contracts.` +
            " Approvals to contracts outside this list are not shown."
          : "Approvals let a contract move your tokens until you revoke them."}
      </AppText>

      {approvals.length > 0 && (
        <View style={styles.summary}>
          <AppText variant="overline" tone="muted">
            At risk right now
          </AppText>

          <AppText variant="title" tone="paper" tabular>
            {formatUsd(totalExposure)}
          </AppText>

          <AppText variant="caption" tone={unlimitedCount > 0 ? "warning" : "muted"}>
            {approvals.length} active approval
            {approvals.length === 1 ? "" : "s"}
            {unlimitedCount > 0 ? ` · ${unlimitedCount} unlimited` : ""}
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
                <AppText variant="bodyStrong">{approval.tokenSymbol}</AppText>

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
