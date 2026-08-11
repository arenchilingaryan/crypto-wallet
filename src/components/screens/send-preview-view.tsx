import { Pressable, View } from "react-native";

import { Screen } from "@/components/ui/screen";
import { AppText } from "@/components/ui/text";
import type { Erc20TransferPreview } from "@/core/transactions/createErc20TransferPreview";
import type { NativeTransferPreview } from "@/core/transactions/createNativeTransferPreview";
import { shortenAddress } from "@/utils/format";

import { styles } from "./send-preview-view.styles";

type SendPreviewViewProps = {
  preview: NativeTransferPreview | Erc20TransferPreview;

  onBack: () => void;

  // Подключим к re-auth
  // следующим шагом.
  onConfirm: () => void;
};

export function SendPreviewView({
  preview,
  onBack,
  onConfirm,
}: SendPreviewViewProps) {
  return (
    <Screen>
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

      <AppText variant="caption" tone="muted" style={styles.notice}>
        Review the recipient, network and amount before continuing.
      </AppText>

      <Pressable
        onPress={onConfirm}
        style={({ pressed }) => [
          styles.confirmButton,
          pressed && styles.pressed,
        ]}
      >
        <AppText variant="label">Confirm</AppText>
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

      <AppText
        variant={strong ? "bodyStrong" : "bodyStrong"}
        mono={mono}
        style={styles.rowValue}
      >
        {value}
      </AppText>
    </View>
  );
}
