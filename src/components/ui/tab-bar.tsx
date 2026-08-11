import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors, Spacing } from "@/constants/theme";

import { styles } from "./tab-bar.styles";
import { AppText } from "./text";

/**
 * Плавающий док вместо системной полосы: активная вкладка — пилюля
 * с иконкой и подписью, неактивные — только приглушённые иконки.
 * Бар остаётся в потоке (не absolute), поэтому контент под него не уезжает.
 */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: insets.bottom + Spacing.md,
        },
      ]}
    >
      <View style={styles.dock}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];

          const focused = state.index === index;

          const label = options.title ?? route.name;

          const color = focused ? Colors.paper : Colors.textMuted;

          function handlePress() {
            const event = navigation.emit({
              type: "tabPress",

              target: route.key,

              canPreventDefault: true,
            });

            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          }

          return (
            <Pressable
              key={route.key}
              onPress={handlePress}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              style={({ pressed }) => [
                styles.item,
                focused && styles.itemActive,
                pressed && !focused && styles.itemPressed,
              ]}
            >
              {options.tabBarIcon?.({
                focused,

                color,

                size: 20,
              })}

              {focused && (
                <AppText variant="label" tone="paper" numberOfLines={1}>
                  {label}
                </AppText>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
