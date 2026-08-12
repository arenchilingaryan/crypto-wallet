import { Pressable, View } from "react-native";

import { Screen } from "@/components/ui/screen";
import { AppText } from "@/components/ui/text";
import type {
  SwapApprovePreview,
  SwapPreview,
} from "@/core/transactions/createSwapPreview";
import { shortenAddress } from "@/utils/format";

import { styles } from "./swap-preview-view.styles";

type SwapPreviewViewProps = {
  preview: SwapPreview | SwapApprovePreview;

  onBack: () => void;

  onConfirm: () => void;
};

export function SwapPreviewView({
  preview,
  onBack,
  onConfirm,
}: SwapPreviewViewProps) {
  const isApprove = preview.kind === "swap-approve";

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

        <AppText variant="heading">
          {isApprove ? "Approve token" : "Confirm swap"}
        </AppText>
      </View>

      <View style={styles.amount}>
        <AppText variant="caption" tone="muted">
          {isApprove ? "Allow the router to spend" : "You pay"}
        </AppText>

        <AppText variant="display">
          {isApprove
            ? `${preview.amount} ${preview.symbol}`
            : `${preview.amountIn} ${preview.symbolIn}`}
        </AppText>

        {!isApprove && (
          <AppText variant="bodyStrong" tone="success" tabular>
            → {preview.quotedAmountOut} {preview.symbolOut}
          </AppText>
        )}
      </View>

      <View style={styles.details}>
        <Row label="From" value={shortenAddress(preview.from)} mono />

        {isApprove ? (
          <>
            <Row label="Token" value={shortenAddress(preview.token)} mono />

            <Row
              label="Spender"
              value={`Uniswap router ${shortenAddress(preview.spender)}`}
              mono
            />
          </>
        ) : (
          <>
            <Row label="Rate" value={preview.rate} />

            <Row label="Route" value={preview.routeLabel} />

            <Row label="Slippage" value={preview.slippagePercent} />

            <Row
              label="Min received"
              value={`${preview.minAmountOut} ${preview.symbolOut}`}
              strong
            />
          </>
        )}

        <Row label="Network" value={preview.network} />

        <View style={styles.divider} />

        <Row
          label="Max network fee"
          value={`${preview.maximumNetworkFeeEth} ETH`}
        />
      </View>

      <AppText variant="caption" tone="muted" style={styles.notice}>
        {isApprove
          ? "The approval only lets the Uniswap router spend this exact amount. The swap itself is a separate transaction."
          : "The swap reverts if the received amount would drop below the minimum."}
      </AppText>

      <Pressable
        onPress={onConfirm}
        style={({ pressed }) => [
          styles.confirmButton,
          pressed && styles.pressed,
        ]}
      >
        <AppText variant="label">
          {isApprove ? "Approve" : "Confirm swap"}
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
      <AppText variant="caption" tone={strong ? "secondary" : "muted"}>
        {label}
      </AppText>

      <AppText variant="bodyStrong" mono={mono} style={styles.rowValue}>
        {value}
      </AppText>
    </View>
  );
}
