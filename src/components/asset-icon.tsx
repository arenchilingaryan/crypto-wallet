import { useState } from "react";

import { View } from "react-native";

import { Image } from "expo-image";

import Svg, { Polygon } from "react-native-svg";

import { AppText } from "@/components/ui/text";

import { styles } from "./asset-icon.styles";

type AssetIconProps = {
  symbol: string;

  logo?: string | null;

  type?: "native" | "erc20";

  size?: number;
};

function EthereumIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Polygon points="16,3 8,16 16,20 24,16" fill="#FFFFFF" />

      <Polygon points="16,21.5 8,17.5 16,29 24,17.5" fill="#B9B9B9" />

      <Polygon points="16,3 16,20 24,16" fill="#D7D7D7" />

      <Polygon points="16,21.5 16,29 24,17.5" fill="#8F8F8F" />
    </Svg>
  );
}

export function AssetIcon({ symbol, logo, type, size = 44 }: AssetIconProps) {
  const [imageFailed, setImageFailed] = useState(false);

  const isEthereum = type === "native" && symbol.toUpperCase() === "ETH";

  const showImage = Boolean(logo) && !imageFailed;

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
    >
      {showImage ? (
        <Image
          source={logo}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
          }}
          contentFit="contain"
          cachePolicy="memory-disk"
          transition={120}
          onError={() => {
            setImageFailed(true);
          }}
        />
      ) : isEthereum ? (
        <EthereumIcon size={size * 0.72} />
      ) : (
        <AppText variant="label">{symbol.slice(0, 2).toUpperCase()}</AppText>
      )}
    </View>
  );
}
