import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { Pressable, View } from "react-native";
import QRCode from "react-native-qrcode-svg";

import { AppText } from "@/components/ui/text";

import { styles } from "./receive-view.styles";

type ReceiveViewProps = {
  address: string;
  symbol: string;
  network: string;
};

export function ReceiveView({ address, symbol, network }: ReceiveViewProps) {
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
          {network}
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

      <View style={styles.addressCard}>
        <AppText variant="overline" tone="muted">
          Your address
        </AppText>

        <AppText variant="bodyStrong" mono selectable style={styles.address}>
          {address}
        </AppText>
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
