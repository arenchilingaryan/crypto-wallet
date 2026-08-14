import type { ReactNode } from "react";
import { View } from "react-native";

import { styles } from "./footer.styles";

export function Footer({ children }: { children: ReactNode }) {
  return <View style={styles.footer}>{children}</View>;
}
