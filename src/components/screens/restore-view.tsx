import { Button } from "@/components/ui/button";
import { Footer } from "@/components/ui/footer";
import { Input } from "@/components/ui/input";
import { Screen } from "@/components/ui/screen";
import { ScreenHeader } from "@/components/ui/screen-header";
import { styles } from "./restore-view.styles";

type RestoreViewProps = {
  mnemonic: string;
  error: string | null;
  onChangeMnemonic: (value: string) => void;
  onSubmit: () => void;
  onBack: () => void;
};

export function RestoreView({
  mnemonic,
  error,
  onChangeMnemonic,
  onSubmit,
  onBack,
}: RestoreViewProps) {
  return (
    <Screen scroll onBack={onBack}>
      <ScreenHeader
        title="Restore wallet"
        subtitle="Enter your recovery phrase, words separated by spaces."
      />

      <Input
        value={mnemonic}
        onChangeText={onChangeMnemonic}
        placeholder="word1 word2 word3 …"
        error={error}
        mono
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.phraseInput}
      />

      <Footer>
        <Button
          title="Restore wallet"
          onPress={onSubmit}
          disabled={mnemonic.trim().length === 0}
        />
      </Footer>
    </Screen>
  );
}
