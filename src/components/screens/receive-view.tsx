import * as Clipboard from "expo-clipboard";

import { useState } from "react";

import { Pressable, View } from "react-native";

import QRCode from "react-native-qrcode-svg";

import { AppText } from "@/components/ui/text";

import { styles } from "./receive-view.styles";

type ReceiveViewProps = {
  address: string;
  symbol: string;
  assetName: string;
  network: string;
  contractAddress: string | null;
};

export function ReceiveView({
  address,
  symbol,
  assetName,
  network,
  contractAddress,
}: ReceiveViewProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await Clipboard.setStringAsync(address);

    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 1500);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <AppText variant="heading">Receive {symbol}</AppText>

        <AppText variant="caption" tone="muted">
          {assetName}
        </AppText>
      </View>

      <View style={styles.qrSection}>
        <View style={styles.qr}>
          <QRCode
            value={address}
            size={200}
            color="#000000"
            backgroundColor="#FFFFFF"
          />
        </View>
      </View>

      <View style={styles.details}>
        <View style={styles.detailRow}>
          <AppText variant="caption" tone="muted">
            Network
          </AppText>

          <AppText variant="bodyStrong">{network}</AppText>
        </View>

        <View style={styles.detailDivider} />

        <View style={styles.detailBlock}>
          <AppText variant="caption" tone="muted">
            Your address
          </AppText>

          <AppText variant="bodyStrong" mono selectable style={styles.address}>
            {address}
          </AppText>
        </View>

        {contractAddress && (
          <>
            <View style={styles.detailDivider} />

            <View style={styles.detailBlock}>
              <AppText variant="caption" tone="muted">
                Token contract
              </AppText>

              <AppText
                variant="caption"
                tone="secondary"
                mono
                selectable
                style={styles.address}
              >
                {contractAddress}
              </AppText>
            </View>
          </>
        )}
      </View>

      <Pressable
        onPress={handleCopy}
        style={({ pressed }) => [
          styles.copyButton,
          pressed && styles.copyButtonPressed,
        ]}
      >
        <AppText variant="label">{copied ? "Copied" : "Copy address"}</AppText>
      </Pressable>

      <AppText variant="caption" tone="muted" style={styles.warning}>
        Only send {symbol} on {network} to this address.
      </AppText>
    </View>
  );
}
