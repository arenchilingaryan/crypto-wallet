import Svg, { Circle, Path } from "react-native-svg";

type SettingsIconProps = {
  size?: number;
  color?: string;
};

export function SettingsIcon({
  size = 22,
  color = "#FFFFFF",
}: SettingsIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth="1.8" />

      <Path
        d="
          M12 3.5V5
          M12 19V20.5

          M20.5 12H19
          M5 12H3.5

          M18 6L16.9 7.1
          M7.1 16.9L6 18

          M18 18L16.9 16.9
          M7.1 7.1L6 6
        "
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />

      <Circle cx="12" cy="12" r="6.5" stroke={color} strokeWidth="1.8" />
    </Svg>
  );
}
