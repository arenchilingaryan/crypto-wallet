import { View } from "react-native";

import { Button } from "@/components/ui/button";
import { Footer } from "@/components/ui/footer";
import { Screen } from "@/components/ui/screen";
import { ScreenHeader } from "@/components/ui/screen-header";
import { AppText } from "@/components/ui/text";

import type { RevokePreview } from "@/core/transactions/createRevokePreview";

import { shortenAddress } from "@/utils/format";

import { styles } from "./revoke-preview-view.styles";

type RevokePreviewViewProps = {
  preview: RevokePreview;

  onBack: () => void;

  onConfirm: () => void;
};

export function RevokePreviewView({
  preview,
  onBack,
  onConfirm,
}: RevokePreviewViewProps) {
  return (
    <Screen scroll onBack={onBack}>
      <ScreenHeader
        title="Revoke approval"
        subtitle={`${preview.spenderName} will no longer be able to move your ${preview.symbol}.`}
      />

      <View style={styles.card}>
        <Row label="Token" value={preview.symbol} />

        <Row
          label="Contract"
          value={shortenAddress(preview.token)}
          mono
          divider
        />

        <Row label="Spender" value={preview.spenderName} divider />

        <Row
          label="Spender address"
          value={shortenAddress(preview.spender)}
          mono
          divider
        />

        <Row label="New allowance" value="0" divider />

        <Row label="Network" value={preview.network} divider />

        <Row
          label="Max network fee"
          value={`${preview.maximumNetworkFeeEth} ETH`}
          divider
        />
      </View>

      <AppText variant="caption" tone="muted" style={styles.notice}>
        Revoking costs a network fee and does not move your tokens. You can
        approve this contract again later if you need it.
      </AppText>

      <Footer>
        <Button title="Revoke" onPress={onConfirm} />
      </Footer>
    </Screen>
  );
}

type RowProps = {
  label: string;
  value: string;
  mono?: boolean;
  divider?: boolean;
};

function Row({ label, value, mono = false, divider = false }: RowProps) {
  return (
    <View style={[styles.row, divider && styles.rowDivider]}>
      <AppText variant="caption" tone="muted">
        {label}
      </AppText>

      <AppText
        variant="bodyStrong"
        mono={mono}
        numberOfLines={1}
        style={styles.rowValue}
      >
        {value}
      </AppText>
    </View>
  );
}
