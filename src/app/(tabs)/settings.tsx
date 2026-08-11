import Constants from "expo-constants";

import { useRouter } from "expo-router";

import { SettingsView } from "@/components/screens/settings-view";

import { ACTIVE_NETWORK } from "@/constants/networks";

export default function SettingsScreen() {
  const router = useRouter();

  return (
    <SettingsView
      networkName={ACTIVE_NETWORK.name}
      version={Constants.expoConfig?.version ?? "1.0.0"}
      onManageWallets={() => {
        router.push("/wallets");
      }}
      onChangePin={() => {
        router.push("/change-pin");
      }}
    />
  );
}
