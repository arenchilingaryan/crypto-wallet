import Constants from "expo-constants";

import { useRouter } from "expo-router";

import { goBack } from "@/utils/navigation";

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
      onRevealPhrase={() => {
        router.push("/reveal");
      }}
      onOpenLimits={() => {
        router.push("/limits");
      }}
      onRepairRecords={() => {
        router.push("/repair");
      }}
      onBack={() => {
        goBack("/");
      }}
    />
  );
}
