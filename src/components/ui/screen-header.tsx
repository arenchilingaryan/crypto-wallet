import { View } from "react-native";

import { styles } from "./screen-header.styles";
import { AppText } from "./text";

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
};

export function ScreenHeader({ title, subtitle }: ScreenHeaderProps) {
  return (
    <View style={styles.header}>
      <AppText variant="title">{title}</AppText>
      {subtitle && (
        <AppText variant="body" tone="secondary">
          {subtitle}
        </AppText>
      )}
    </View>
  );
}
