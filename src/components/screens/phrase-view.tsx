import { usePreventScreenCapture } from "expo-screen-capture";

import { PhraseGrid } from "@/components/phrase-grid";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/ui/footer";
import { Screen } from "@/components/ui/screen";
import { ScreenHeader } from "@/components/ui/screen-header";
import { AppText } from "@/components/ui/text";
import { styles } from "./phrase-view.styles";

type PhraseViewProps = {
  words: string[];
  onDone: () => void;
  onCancel: () => void;
};

export function PhraseView({ words, onDone, onCancel }: PhraseViewProps) {
  usePreventScreenCapture("wallet-phrase-view");

  return (
    <Screen scroll onBack={onCancel}>
      <ScreenHeader
        title="Recovery phrase"
        subtitle="The only way to restore your wallet. Write the words down in order and keep them somewhere safe, offline."
      />

      <PhraseGrid words={words} />

      <AppText variant="caption" tone="warning" style={styles.caution}>
        Never share these words. Anyone who has them controls your funds.
      </AppText>

      <Footer>
        <Button title="I've written them down" onPress={onDone} />
      </Footer>
    </Screen>
  );
}
