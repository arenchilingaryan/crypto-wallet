import { View } from "react-native";

import { Button } from "@/components/ui/button";
import { Footer } from "@/components/ui/footer";
import { Screen } from "@/components/ui/screen";
import { AppText } from "@/components/ui/text";
import { styles } from "./onboarding-view.styles";

type OnboardingViewProps = {
  onCreate: () => void;
  onRestore: () => void;
};

export function OnboardingView({ onCreate, onRestore }: OnboardingViewProps) {
  return (
    <Screen>
      <View style={styles.hero}>
        <AppText variant="title" style={styles.centerText}>
          Set up your wallet
        </AppText>
        <AppText variant="body" tone="secondary" style={styles.centerText}>
          Create a new wallet, or restore one you already have from its
          recovery phrase. Keys are stored only on this device.
        </AppText>
      </View>

      <Footer>
        <Button title="Create new wallet" onPress={onCreate} />
        <Button
          title="Restore existing wallet"
          variant="secondary"
          onPress={onRestore}
        />
      </Footer>
    </Screen>
  );
}
