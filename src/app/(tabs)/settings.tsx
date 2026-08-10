import { Pressable, View } from "react-native";

import { useRouter } from "expo-router";

import { Screen } from "@/components/ui/screen";
import { AppText } from "@/components/ui/text";

export default function SettingsScreen() {
  const router = useRouter();

  return (
    <Screen>
      <AppText variant="heading">Settings</AppText>

      <View>
        <Pressable
          onPress={() => {
            router.push("/wallets");
          }}
        >
          <AppText variant="bodyStrong">Wallets</AppText>

          <AppText variant="caption" tone="muted">
            Manage wallets and active account
          </AppText>
        </Pressable>
      </View>
    </Screen>
  );
}
