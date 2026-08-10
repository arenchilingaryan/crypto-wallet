import Svg, { Circle, Line } from "react-native-svg";

type SearchIconProps = {
  size?: number;
  color?: string;
};

export function SearchIcon({ size = 22, color = "#FFFFFF" }: SearchIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="11" cy="11" r="6.5" stroke={color} strokeWidth="2" />

      <Line
        x1="16"
        y1="16"
        x2="21"
        y2="21"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </Svg>
  );
}
