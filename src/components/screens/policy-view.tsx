import { TextInput, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Footer } from "@/components/ui/footer";
import { Screen } from "@/components/ui/screen";
import { ScreenHeader } from "@/components/ui/screen-header";
import { AppText } from "@/components/ui/text";

import { Colors } from "@/constants/theme";

import { hasConfiguredLimits } from "@/core/security/policyDecision";
import {
  DEFAULT_SECURITY_POLICY,
  type SecurityPolicy,
} from "@/core/security/securityPolicy";

import { styles } from "./policy-view.styles";

export type PolicyDraft = {
  maxSingleTransferUsd: string;

  newRecipientMaxUsd: string;

  dailyOutflowLimitUsd: string;

  maxApprovalExposureUsd: string;

  maxSwapLossUsd: string;
};

type PolicyViewProps = {
  draft: PolicyDraft;

  networkName: string;

  enforced: boolean;

  saving: boolean;

  saved: boolean;

  onChange: (draft: PolicyDraft) => void;

  onSave: () => void;

  onBack: () => void;
};

export function policyToDraft(policy: SecurityPolicy): PolicyDraft {
  const format = (value: number | null) =>
    value === null ? "" : String(value);

  return {
    maxSingleTransferUsd: format(policy.maxSingleTransferUsd),

    newRecipientMaxUsd: format(policy.newRecipientMaxUsd),

    dailyOutflowLimitUsd: format(policy.dailyOutflowLimitUsd),

    maxApprovalExposureUsd: format(policy.maxApprovalExposureUsd),

    maxSwapLossUsd: format(policy.maxSwapLossUsd),
  };
}

export function draftToPolicy(
  draft: PolicyDraft,
  base: SecurityPolicy = DEFAULT_SECURITY_POLICY,
): SecurityPolicy {
  const parse = (value: string) => {
    const numeric = Number(value.replace(/[^\d.]/g, ""));

    return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
  };

  return {
    ...base,

    version: 1,

    maxSingleTransferUsd: parse(draft.maxSingleTransferUsd),

    newRecipientMaxUsd: parse(draft.newRecipientMaxUsd),

    dailyOutflowLimitUsd: parse(draft.dailyOutflowLimitUsd),

    maxApprovalExposureUsd: parse(draft.maxApprovalExposureUsd),

    maxSwapLossUsd: parse(draft.maxSwapLossUsd),
  };
}

export function PolicyView({
  draft,
  networkName,
  enforced,
  saving,
  saved,
  onChange,
  onSave,
  onBack,
}: PolicyViewProps) {
  const configured = draftToPolicy(draft);

  const hasAnyRule =
    hasConfiguredLimits(configured) ||
    configured.maxApprovalExposureUsd !== null ||
    configured.maxSwapLossUsd !== null;

  return (
    <Screen scroll onBack={onBack}>
      <ScreenHeader
        title="Transaction limits"
        subtitle="Rules checked before a transfer, an approval or a swap is prepared or signed."
      />

      {!hasAnyRule && (
        <AppText variant="caption" tone="muted" style={styles.notice}>
          No dollar limit is set. Unlimited approvals and unknown contracts are
          still refused; everything else passes.
        </AppText>
      )}

      {hasAnyRule && !enforced && (
        <AppText variant="caption" tone="warning" style={styles.notice}>
          {networkName} has no market prices, so dollar limits cannot be
          applied there. These rules take effect on a network with prices.
        </AppText>
      )}

      <AppText variant="caption" tone="muted" style={styles.notice}>
        Leave a field empty to disable that rule. These limits cover sending
        ETH and tokens from this app, checked against live prices. If an asset
        has no price, or your history cannot be loaded, the transfer is
        blocked rather than waved through.
      </AppText>

      <AppText variant="caption" tone="muted" style={styles.notice}>
        Approvals and swaps have their own rules. Whatever you set here, this
        wallet always refuses an unlimited approval and refuses to give
        permission to a contract it does not recognise. Set a dollar cap below
        to also limit how much a single approval may put within reach of a
        contract, and how much a swap may cost you in the worst case it
        accepts.
      </AppText>

      <Rule
        title="Largest single approval"
        description="Caps the value a contract may be allowed to move on your behalf."
        value={draft.maxApprovalExposureUsd}
        onChangeText={(value) =>
          onChange({ ...draft, maxApprovalExposureUsd: value })
        }
      />

      <Rule
        title="Worst case loss on a swap"
        description="Blocks a swap whose guaranteed minimum is this much below what you put in."
        value={draft.maxSwapLossUsd}
        onChangeText={(value) => onChange({ ...draft, maxSwapLossUsd: value })}
      />

      <Rule
        title="Maximum single transfer"
        description="Blocks any one transaction above this amount."
        value={draft.maxSingleTransferUsd}
        onChangeText={(value) =>
          onChange({ ...draft, maxSingleTransferUsd: value })
        }
      />

      <Rule
        title="First transfer to a new address"
        description="Caps the amount you can send to an address you have never sent to before."
        value={draft.newRecipientMaxUsd}
        onChangeText={(value) =>
          onChange({ ...draft, newRecipientMaxUsd: value })
        }
      />

      <Rule
        title="Daily outflow"
        description="Caps the total value leaving this wallet within 24 hours."
        value={draft.dailyOutflowLimitUsd}
        onChangeText={(value) =>
          onChange({ ...draft, dailyOutflowLimitUsd: value })
        }
      />

      <AppText variant="caption" tone="muted" style={styles.footerNote}>
        These rules run inside the wallet, on this device. They limit damage
        from a mistake or a swapped address — they cannot stop someone who
        already knows your PIN.
      </AppText>

      <Footer>
        <Button
          title={saved ? "Saved" : saving ? "Saving…" : "Save limits"}
          onPress={onSave}
          disabled={saving}
        />
      </Footer>
    </Screen>
  );
}

type RuleProps = {
  title: string;
  description: string;
  value: string;
  onChangeText: (value: string) => void;
};

function Rule({ title, description, value, onChangeText }: RuleProps) {
  return (
    <View style={styles.rule}>
      <View style={styles.ruleHeader}>
        <AppText variant="bodyStrong">{title}</AppText>

        <AppText variant="caption" tone="muted">
          {description}
        </AppText>
      </View>

      <View style={styles.inputRow}>
        <AppText variant="bodyStrong" tone="muted" style={styles.currency}>
          $
        </AppText>

        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder="No limit"
          placeholderTextColor={Colors.textMuted}
          keyboardType="decimal-pad"
          style={styles.input}
        />
      </View>
    </View>
  );
}
