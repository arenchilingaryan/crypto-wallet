import { Tabs } from "expo-router";

import { ActivityIcon } from "@/components/icons/activity-icon";
import { HomeIcon } from "@/components/icons/home-icon";
import { ReceiveIcon } from "@/components/icons/receive-icon";
import { SettingsIcon } from "@/components/icons/settings-icon";
import { TabBar } from "@/components/ui/tab-bar";

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
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
