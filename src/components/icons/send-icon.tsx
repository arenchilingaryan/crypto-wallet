import Svg, { Path } from "react-native-svg";

type SendIconProps = {
  size?: number;
  color?: string;
};

export function SendIcon({ size = 22, color = "#FFFFFF" }: SendIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 20V5"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <Path
        d="M5.5 11.5L12 5L18.5 11.5"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
