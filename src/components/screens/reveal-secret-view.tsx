import { useState } from "react";

import { Pressable, View } from "react-native";

import { PhraseGrid } from "@/components/phrase-grid";
import { Screen } from "@/components/ui/screen";
import { ScreenHeader } from "@/components/ui/screen-header";
import { AppText } from "@/components/ui/text";

import type { RevealedSecret } from "@/core/wallet/revealSecret";

import { shortenAddress } from "@/utils/format";

import { styles } from "./reveal-secret-view.styles";

type RevealSecretViewProps = {
  secret: RevealedSecret;

  onBack: () => void;
};

export function RevealSecretView({ secret, onBack }: RevealSecretViewProps) {
  const [showPhrase, setShowPhrase] = useState(false);

  const [showKey, setShowKey] = useState(false);

  return (
    <Screen scroll onBack={onBack}>
      <ScreenHeader
        title="Recovery phrase"
        subtitle={`Wallet ${shortenAddress(secret.address)}`}
      />

      <AppText variant="caption" tone="danger" style={styles.warning}>
        Anyone who sees these words owns this wallet. Nobody legitimate will
        ever ask you for them. Do not photograph this screen and do not paste
        them into any site or chat.
      </AppText>

      {showPhrase ? (
        <PhraseGrid words={secret.recoveryPhrase.split(" ")} />
      ) : (
        <Pressable style={styles.cover} onPress={() => setShowPhrase(true)}>
          <AppText variant="bodyStrong" tone="paper">
            Tap to show the 12 words
          </AppText>

          <AppText variant="caption" tone="muted">
            Make sure nobody is looking over your shoulder
          </AppText>
        </Pressable>
      )}

      <View style={styles.section}>
        <AppText variant="overline" tone="muted">
          Private key
        </AppText>

        {showKey ? (
          <AppText variant="body" mono selectable style={styles.key}>
            {secret.privateKey}
          </AppText>
        ) : (
          <Pressable style={styles.cover} onPress={() => setShowKey(true)}>
            <AppText variant="bodyStrong" tone="paper">
              Tap to show the private key
            </AppText>

            <AppText variant="caption" tone="muted">
              This key controls only this one address
            </AppText>
          </Pressable>
        )}
      </View>

      <AppText variant="caption" tone="muted" style={styles.footnote}>
        The phrase restores every address of this wallet. The private key
        restores only the address above. Store the phrase offline; it is the
        only thing that survives losing this device.
      </AppText>
    </Screen>
  );
}
