import { View } from "react-native";

import { styles } from "./change-badge.styles";
import { AppText } from "./text";

type ChangeBadgeProps = {
  changePercent: number | null;

  period?: string;
};

export function ChangeBadge({ changePercent, period }: ChangeBadgeProps) {
  if (changePercent === null || !Number.isFinite(changePercent)) {
    return null;
  }

  const positive = changePercent >= 0;

  return (
    <View style={styles.badge}>
      <AppText variant="caption" tone={positive ? "success" : "danger"}>
        {positive ? "▲" : "▼"}
      </AppText>

      <AppText
        variant="caption"
        tone={positive ? "success" : "danger"}
        tabular
      >
        {positive ? "+" : ""}
        {changePercent.toFixed(2)}%
      </AppText>

      {period && (
        <AppText variant="caption" tone="muted">
          {period}
        </AppText>
      )}
    </View>
  );
}
