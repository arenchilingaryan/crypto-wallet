import Svg, { Path } from "react-native-svg";

type HomeIconProps = {
  size?: number;
  color?: string;
};

export function HomeIcon({ size = 22, color = "#FFFFFF" }: HomeIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 10.5L12 3L21 10.5"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <Path
        d="M5.5 9V20H18.5V9"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <Path
        d="M9.5 20V14H14.5V20"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
