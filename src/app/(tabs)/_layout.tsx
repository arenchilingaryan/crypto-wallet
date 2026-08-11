import { Redirect, Tabs, useFocusEffect } from "expo-router";

import { useCallback, useState } from "react";

import { ActivityIndicator, View } from "react-native";

import { ActivityIcon } from "@/components/icons/activity-icon";
import { HomeIcon } from "@/components/icons/home-icon";
import { ReceiveIcon } from "@/components/icons/receive-icon";
import { SettingsIcon } from "@/components/icons/settings-icon";

import { TabBar } from "@/components/ui/tab-bar";

import { Colors } from "@/constants/theme";

import { walletApi } from "@/platform/react-native/walletApi";

type WalletGateState = "loading" | "ready" | "missing";

export default function TabsLayout() {
  const [walletState, setWalletState] = useState<WalletGateState>("loading");

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      setWalletState("loading");

      void walletApi
        .load()
        .then((wallet) => {
          if (!mounted) {
            return;
          }

          setWalletState(wallet ? "ready" : "missing");
        })
        .catch((error) => {
          console.error("Tabs wallet gate failed:", error);

          if (mounted) {
            setWalletState("missing");
          }
        });

      return () => {
        mounted = false;
      };
    }, []),
  );

  if (walletState === "loading") {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={Colors.textSecondary} />
      </View>
    );
  }

  if (walletState === "missing") {
    return <Redirect href="/onboarding" />;
  }

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
