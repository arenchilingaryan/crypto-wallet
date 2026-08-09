import { View } from "react-native";

import { Button } from "@/components/ui/button";
import { Footer } from "@/components/ui/footer";
import { Input } from "@/components/ui/input";
import { Screen } from "@/components/ui/screen";
import { ScreenHeader } from "@/components/ui/screen-header";
import { AppText } from "@/components/ui/text";
import { styles } from "./verify-view.styles";

type VerifyViewProps = {
  word3: string;
  word7: string;
  word11: string;
  error: string | null;
  onChangeWord3: (value: string) => void;
  onChangeWord7: (value: string) => void;
  onChangeWord11: (value: string) => void;
  onConfirm: () => void;
  onShowPhrase: () => void;
};

export function VerifyView({
  word3,
  word7,
  word11,
  error,
  onChangeWord3,
  onChangeWord7,
  onChangeWord11,
  onConfirm,
  onShowPhrase,
}: VerifyViewProps) {
  return (
    <Screen scroll onBack={onShowPhrase}>
      <ScreenHeader
        title="Verify your phrase"
        subtitle="Enter the requested words to make sure your backup is correct."
      />

      <View style={styles.form}>
        <Input
          label="Word #3"
          value={word3}
          onChangeText={onChangeWord3}
          mono
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Input
          label="Word #7"
          value={word7}
          onChangeText={onChangeWord7}
          mono
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Input
          label="Word #11"
          value={word11}
          onChangeText={onChangeWord11}
          mono
          autoCapitalize="none"
          autoCorrect={false}
        />

        {error && (
          <AppText variant="caption" tone="danger">
            {error}
          </AppText>
        )}
      </View>

      <Footer>
        <Button title="Confirm" onPress={onConfirm} />
      </Footer>
    </Screen>
  );
}
