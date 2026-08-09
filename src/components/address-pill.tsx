import { useState } from "react";
import { Pressable } from "react-native";

import { shortenAddress } from "@/utils/format";
import { styles } from "./address-pill.styles";
import { AppText } from "./ui/text";

type AddressPillProps = {
  address: string;
  onPress?: () => void;
};

export function AddressPill({ address, onPress }: AddressPillProps) {
  const [expanded, setExpanded] = useState(false);

  function handlePress() {
    if (onPress) {
      onPress();
      return;
    }

    setExpanded((value) => !value);
  }

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
    >
      <AppText
        variant="caption"
        tone="accent"
        mono
        selectable={expanded && !onPress}
      >
        {onPress || !expanded ? shortenAddress(address) : address}
      </AppText>
    </Pressable>
  );
}
