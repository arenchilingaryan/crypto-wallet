import type { ReactNode } from "react";
import { View } from "react-native";

import { styles } from "./footer.styles";

/** Bottom-anchored action block: pushes itself to the end of the screen. */
export function Footer({ children }: { children: ReactNode }) {
  return <View style={styles.footer}>{children}</View>;
}
