import { useRouter } from "expo-router";

import { Screen } from "@/components/ui/screen";
import { AppText } from "@/components/ui/text";
import { Spacing } from "@/constants/theme";

export default function ExploreScreen() {
  const router = useRouter();

  return (
    <Screen
      onBack={() => {
        if (router.canGoBack()) {
          router.back();
          return;
        }

        router.replace("/");
      }}
      style={{
        alignItems: "center",
        justifyContent: "center",
        gap: Spacing.sm,
      }}
    >
      <AppText variant="heading">Explore</AppText>
      <AppText variant="body" tone="muted">
        Nothing here yet.
      </AppText>
    </Screen>
  );
}
