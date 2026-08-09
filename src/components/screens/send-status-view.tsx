import { Pressable, View } from "react-native";

import { Screen } from "@/components/ui/screen";
import { AppText } from "@/components/ui/text";
import { shortenAddress } from "@/utils/format";

import { styles } from "./send-status-view.styles";

export type SendStatus =
  | "broadcasting"
  | "pending"
  | "confirmed"
  | "reverted"
  | "submitted";

type SendStatusViewProps = {
  status: SendStatus;

  hash: string | null;

  onDone: () => void;
};

export function SendStatusView({ status, hash, onDone }: SendStatusViewProps) {
  const content = getStatusContent(status);

  return (
    <Screen style={styles.screen}>
      <View style={styles.content}>
        <AppText variant="heading">{content.title}</AppText>

        <AppText variant="bodyStrong" style={styles.message}>
          {content.message}
        </AppText>

        {hash && (
          <View style={styles.hash}>
            <AppText variant="caption" tone="muted">
              Transaction hash
            </AppText>

            <AppText variant="bodyStrong" mono selectable>
              {shortenAddress(hash)}
            </AppText>
          </View>
        )}

        {(status === "confirmed" ||
          status === "reverted" ||
          status === "submitted") && (
          <Pressable
            onPress={onDone}
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          >
            <AppText variant="label">Done</AppText>
          </Pressable>
        )}
      </View>
    </Screen>
  );
}

function getStatusContent(status: SendStatus) {
  switch (status) {
    case "broadcasting":
      return {
        title: "Sending transaction",
        message: "Broadcasting to Ethereum Sepolia…",
      };

    case "pending":
      return {
        title: "Transaction pending",
        message:
          "The transaction was submitted and is waiting for confirmation.",
      };

    case "confirmed":
      return {
        title: "Transaction confirmed",
        message: "The transaction was included in a block.",
      };

    case "reverted":
      return {
        title: "Transaction failed",
        message: "The transaction was included in a block but reverted.",
      };

    case "submitted":
      return {
        title: "Transaction submitted",
        message:
          "The transaction was broadcast, but confirmation status is currently unavailable.",
      };
  }
}
