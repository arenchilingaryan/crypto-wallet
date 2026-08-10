import Svg, { Path } from "react-native-svg";

type BackIconProps = {
  size?: number;
  color?: string;
};

export function BackIcon({ size = 22, color = "#FFFFFF" }: BackIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 5L8 12L15 19"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
