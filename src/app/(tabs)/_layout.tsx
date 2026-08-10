import { Tabs } from "expo-router";

import { ActivityIcon } from "@/components/icons/activity-icon";
import { HomeIcon } from "@/components/icons/home-icon";
import { ReceiveIcon } from "@/components/icons/receive-icon";
import { SettingsIcon } from "@/components/icons/settings-icon";

import { Colors } from "@/constants/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,

        tabBarActiveTintColor: Colors.textPrimary,

        tabBarInactiveTintColor: Colors.textSecondary,

        tabBarStyle: {
          backgroundColor: Colors.surface,

          borderTopColor: Colors.border,

          borderTopWidth: 1,

          height: 82,

          paddingTop: 8,
          paddingBottom: 18,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Wallet",
          tabBarIcon: ({ color }) => <HomeIcon size={22} color={color} />,
        }}
      />

      <Tabs.Screen
        name="activity"
        options={{
          title: "Activity",
          tabBarIcon: ({ color }) => <ActivityIcon size={22} color={color} />,
        }}
      />

      <Tabs.Screen
        name="receive"
        options={{
          title: "Receive",
          tabBarIcon: ({ color }) => <ReceiveIcon size={22} color={color} />,
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => <SettingsIcon size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}
