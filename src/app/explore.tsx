import { Screen } from "@/components/ui/screen";
import { AppText } from "@/components/ui/text";
import { Spacing } from "@/constants/theme";

export default function ExploreScreen() {
  return (
    <Screen
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
