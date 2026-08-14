import { useEffect, useState } from "react";

import { Pressable, View } from "react-native";

import { AppText } from "@/components/ui/text";

import {
  formatTimingRun,
  subscribeToTimingRuns,
  type TimingRun,
} from "@/platform/react-native/timings";

import { styles } from "./timing-notice.styles";

const SLOW_RUN_MS = 1_500;

export function TimingNotice() {
  const [run, setRun] = useState<TimingRun | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") {
      return;
    }

    return subscribeToTimingRuns((next) => {
      console.log(`TIMING ${formatTimingRun(next)}`);

      if (next.totalMs >= SLOW_RUN_MS) {
        setRun(next);
      }
    });
  }, []);

  if (!run || process.env.NODE_ENV === "production") {
    return null;
  }

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <Pressable
        style={styles.notice}
        pointerEvents="auto"
        onPress={() => setRun(null)}
      >
        <AppText variant="caption" tone="paper">
          {formatTimingRun(run)}
        </AppText>

        <AppText variant="caption" tone="muted">
          Slow step measured on this device. Tap to dismiss.
        </AppText>
      </Pressable>
    </View>
  );
}
