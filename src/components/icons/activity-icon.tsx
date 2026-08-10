import Svg, { Circle, Path } from "react-native-svg";

type ActivityIconProps = {
  size?: number;
  color?: string;
};

export function ActivityIcon({
  size = 22,
  color = "#FFFFFF",
}: ActivityIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="8" stroke={color} strokeWidth="1.8" />

      <Path
        d="M12 7.5V12L15.5 14"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <Path
        d="M5.5 5.5L3.5 5.7L3.7 3.7"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
