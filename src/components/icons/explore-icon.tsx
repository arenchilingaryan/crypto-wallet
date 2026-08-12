import Svg, { Circle, Path } from "react-native-svg";

type ExploreIconProps = {
  size?: number;
  color?: string;
};

export function ExploreIcon({ size = 22, color = "#FFFFFF" }: ExploreIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.8" />

      <Path
        d="M15.5 8.5L13.6 13.6L8.5 15.5L10.4 10.4L15.5 8.5Z"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
