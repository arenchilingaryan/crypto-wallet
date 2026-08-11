import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors, Spacing } from "@/constants/theme";

import { styles } from "./tab-bar.styles";
import { AppText } from "./text";

type TabItemProps = {
  focused: boolean;

  label: string;

  icon: ReactNode;

  onPress: () => void;
};

function TabItem({ focused, label, icon, onPress }: TabItemProps) {
  // Пружина на ширину: активная вкладка плавно отбирает место у соседей.
  const growStyle = useAnimatedStyle(() => {
    return {
      flexGrow: withSpring(focused ? 2 : 1, {
        damping: 22,

        stiffness: 220,
      }),
    };
  }, [focused]);

  const pillStyle = useAnimatedStyle(() => {
    return {
      opacity: withTiming(focused ? 1 : 0, {
        duration: 180,
      }),
    };
  }, [focused]);

  return (
    <Animated.View style={[styles.item, growStyle]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={label}
        style={({ pressed }) => [
          styles.itemPressable,
          pressed && !focused && styles.itemPressed,
        ]}
      >
        <Animated.View style={[styles.itemPill, pillStyle]} />

        {icon}

        {focused && (
          <Animated.View entering={FadeIn.duration(160)}>
            <AppText variant="label" tone="paper" numberOfLines={1}>
              {label}
            </AppText>
          </Animated.View>
        )}
      </Pressable>
    </Animated.View>
  );
}

/**
 * Плавающий док вместо системной полосы: активная вкладка — пилюля
 * с иконкой и подписью, неактивные — только приглушённые иконки.
 * Переключение анимировано: пружина по ширине, фейд подложки и подписи.
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
            <TabItem
              key={route.key}
              focused={focused}
              label={label}
              onPress={handlePress}
              icon={options.tabBarIcon?.({
                focused,

                color,

                size: 20,
              })}
            />
          );
        })}
      </View>
    </View>
  );
}
