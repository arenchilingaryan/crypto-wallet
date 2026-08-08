import { useState } from "react";
import { Pressable } from "react-native";

import { shortenAddress } from "@/utils/format";
import { styles } from "./address-pill.styles";
import { AppText } from "./ui/text";

type AddressPillProps = {
  address: string;
};

/** Truncated address chip; tap to toggle the full address. */
export function AddressPill({ address }: AddressPillProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Pressable
      onPress={() => setExpanded((value) => !value)}
      style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
    >
      <AppText variant="caption" tone="secondary" mono selectable={expanded}>
        {expanded ? address : shortenAddress(address)}
      </AppText>
    </Pressable>
  );
}
