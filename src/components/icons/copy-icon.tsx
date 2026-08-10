import Svg, { Rect } from "react-native-svg";

type CopyIconProps = {
  size?: number;
  color?: string;
};

export function CopyIcon({ size = 20, color = "#FFFFFF" }: CopyIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect
        x="9"
        y="9"
        width="10"
        height="10"
        rx="2"
        stroke={color}
        strokeWidth="1.8"
      />

      <Rect
        x="5"
        y="5"
        width="10"
        height="10"
        rx="2"
        stroke={color}
        strokeWidth="1.8"
      />
    </Svg>
  );
}
