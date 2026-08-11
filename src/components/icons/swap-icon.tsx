import Svg, { Path } from "react-native-svg";

type SwapIconProps = {
  size?: number;
  color?: string;
};

export function SwapIcon({ size = 22, color = "#FFFFFF" }: SwapIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 8H20M20 8L16 4M20 8L16 12"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <Path
        d="M20 16H4M4 16L8 12M4 16L8 20"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
