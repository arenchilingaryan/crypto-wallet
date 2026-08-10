import Svg, { Line, Path } from "react-native-svg";

type ReceiveIconProps = {
  size?: number;
  color?: string;
};

export function ReceiveIcon({
  size = 22,
  color = "#FFFFFF",
}: ReceiveIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line
        x1="12"
        y1="4"
        x2="12"
        y2="16"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />

      <Path
        d="M7 11L12 16L17 11"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <Line
        x1="5"
        y1="20"
        x2="19"
        y2="20"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </Svg>
  );
}
