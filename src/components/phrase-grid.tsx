import { View } from "react-native";

import { styles } from "./phrase-grid.styles";
import { AppText } from "./ui/text";

type PhraseGridProps = {
  words: string[];
};

export function PhraseGrid({ words }: PhraseGridProps) {
  return (
    <View style={styles.grid}>
      {words.map((word, index) => (
        <View key={`${index}-${word}`} style={styles.cell}>
          <AppText variant="caption" tone="muted" mono style={styles.index}>
            {String(index + 1).padStart(2, "0")}
          </AppText>
          <AppText variant="label" mono>
            {word}
          </AppText>
        </View>
      ))}
    </View>
  );
}
