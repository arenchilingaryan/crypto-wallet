import { useEffect, useState } from "react";

import { Pressable, View } from "react-native";

import { SecurityBriefing } from "@/components/security/security-briefing";
import { Screen } from "@/components/ui/screen";
import { AppText } from "@/components/ui/text";

import type { SecurityReview } from "@/core/security/securityReview";
import type { RecipientIntelligence } from "@/core/security/recipientIntelligence";
import type { Erc20TransferPreview } from "@/core/transactions/createErc20TransferPreview";
import type { NativeTransferPreview } from "@/core/transactions/createNativeTransferPreview";
import { shortenAddress } from "@/utils/format";

import { styles } from "./send-preview-view.styles";

type SendPreviewViewProps = {
  preview: NativeTransferPreview | Erc20TransferPreview;

  review: SecurityReview | null;

  recipientIntelligence?: RecipientIntelligence | null;

  onBack: () => void;

  onConfirm: () => void;
};

// The identity line is informational and stays low-key (the money risk of a new
// recipient is the firewall's job). Only a lookalike is alarming. Keeping the
// ordinary cases quiet is what stops the rare real warning from being trained
// away. The wording never over-claims: our record is native sends plus this
// device's tracked transfers, so "first-time" says "no record", not "never".
function identityNotice(intel: RecipientIntelligence): string | null {
  switch (intel.identity) {
    case "self":
      return "This is one of your own addresses.";

    case "previously-sent":
      return "Previously used recipient — you have sent here before. That is not the same as safe.";

    case "first-time":
      return "First-time recipient — we have no record of you sending to this address.";

    case "not-seen":
      return "Not among the recent sends we could check — this does not prove you have never used it.";

    case "unknown":
      return "Your recipient history could not be checked right now.";
  }
}

export function SendPreviewView({
  preview,
  review,
  recipientIntelligence,
  onBack,
  onConfirm,
}: SendPreviewViewProps) {
  const blocked = review?.decision.decision === "block";

  const lookalike = recipientIntelligence?.lookalike ?? null;

  const notice = recipientIntelligence
    ? identityNotice(recipientIntelligence)
    : null;

  // When the address collides, under its shortened form, with one already used,
  // the user must acknowledge they compared the full strings before the normal
  // submission flow can start. Not a new screen, not a block — one explicit
  // step in place of a generic Continue.
  const [verified, setVerified] = useState(false);

  // Never carry a "verified" acknowledgement across a change of recipient or of
  // the lookalike set it applied to. The parent remounts this screen per
  // transaction today, but keying on both the recipient and the lookalike
  // fingerprint makes the gate hold even if a future refactor kept the screen
  // mounted and swapped the intelligence in place.
  useEffect(() => {
    setVerified(false);
  }, [preview.to, lookalike?.fingerprint]);

  const needsVerify = Boolean(lookalike) && !verified;

  const confirmLabel = blocked
    ? "This wallet will not sign this"
    : needsVerify
      ? "I compared the full addresses"
      : lookalike
        ? "Send anyway"
        : "Confirm";

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Pressable
          onPress={onBack}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}
        >
          <AppText variant="label">Back</AppText>
        </Pressable>

        <AppText variant="heading">Confirm transaction</AppText>
      </View>

      <View style={styles.amount}>
        <AppText variant="caption" tone="muted">
          You send
        </AppText>

        <AppText variant="display">
          {preview.kind === "native"
            ? `${preview.amountEth} ETH`
            : `${preview.amountToken} ${preview.symbol}`}
        </AppText>
      </View>

      <View style={styles.details}>
        <Row label="From" value={shortenAddress(preview.from)} mono />

        <Row label="To" value={shortenAddress(preview.to)} mono />

        {preview.kind === "erc20" && (
          <Row label="Token" value={shortenAddress(preview.token)} mono />
        )}

        <Row label="Network" value={preview.network} />

        <Row
          label="Max network fee"
          value={`${preview.maximumNetworkFeeEth} ETH`}
        />

        <View style={styles.divider} />

        {preview.kind === "native" ? (
          <Row
            label="Max total"
            value={`${preview.maximumTotalEth} ETH`}
            strong
          />
        ) : (
          <Row
            label="Total"
            value={`${preview.amountToken} ${preview.symbol} + fee`}
            strong
          />
        )}
      </View>

      {notice && (
        <AppText variant="caption" tone="muted" style={styles.intelNotice}>
          {notice}
        </AppText>
      )}

      {lookalike && (
        <View style={styles.lookalike}>
          <AppText variant="overline" tone="danger">
            ⚠ Address lookalike
          </AppText>

          <AppText variant="caption" tone="muted">
            When shortened, the address you entered looks identical to a
            different address you have used before. They are NOT the same
            address. Compare them in full:
          </AppText>

          <AppText variant="caption" tone="muted">
            You entered
          </AppText>

          <AppText variant="caption" mono style={styles.lookalikeAddress}>
            {preview.to}
          </AppText>

          <AppText variant="caption" tone="muted">
            You have previously used
          </AppText>

          {lookalike.matches.map((match) => (
            <AppText
              key={match}
              variant="caption"
              mono
              style={styles.lookalikeAddress}
            >
              {match}
            </AppText>
          ))}
        </View>
      )}

      {review && <SecurityBriefing review={review} />}

      <AppText variant="caption" tone="muted" style={styles.notice}>
        Review the recipient, network and amount before continuing.
      </AppText>

      <Pressable
        disabled={blocked}
        onPress={() => {
          if (blocked) {
            return;
          }

          if (needsVerify) {
            setVerified(true);

            return;
          }

          onConfirm();
        }}
        style={({ pressed }) => [
          styles.confirmButton,
          lookalike && styles.confirmDanger,
          pressed && styles.pressed,
          blocked && styles.disabled,
        ]}
      >
        <AppText variant="label" tone={lookalike ? "danger" : "primary"}>
          {confirmLabel}
        </AppText>
      </Pressable>
    </Screen>
  );
}

function Row({
  label,
  value,
  mono = false,
  strong = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  strong?: boolean;
}) {
  return (
    <View style={styles.row}>
      <AppText variant="caption" tone="muted">
        {label}
      </AppText>

      <AppText variant="bodyStrong" mono={mono} style={styles.rowValue}>
        {value}
      </AppText>
    </View>
  );
}
