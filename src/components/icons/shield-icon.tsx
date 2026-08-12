import Svg, { Path } from "react-native-svg";

type ShieldIconProps = {
  size?: number;
  color?: string;
};

export function ShieldIcon({ size = 22, color = "#FFFFFF" }: ShieldIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3L19 6V11.5C19 15.6 16.1 19.4 12 21C7.9 19.4 5 15.6 5 11.5V6L12 3Z"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <Path
        d="M9 12L11.2 14L15 10"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
