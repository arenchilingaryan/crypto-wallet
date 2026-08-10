import { useCallback, useState } from "react";

import { useFocusEffect, useRouter } from "expo-router";

import { ActivityView } from "@/components/screens/activity-view";

import { getActivity } from "@/core/blockchain/getActivity";

import type { ActivityItem } from "@/core/blockchain/activity";

import { walletApi } from "@/platform/react-native/walletApi";

export default function ActivityScreen() {
  const router = useRouter();

  const [items, setItems] = useState<ActivityItem[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      void (async () => {
        try {
          setLoading(true);
          setError(null);

          const wallet = await walletApi.load();

          if (!wallet) {
            throw new Error("Active wallet not found");
          }

          const activity = await getActivity(wallet.address);

          if (!active) {
            return;
          }

          setItems(activity);
        } catch (activityError) {
          console.error("Activity load failed:", activityError);

          if (!active) {
            return;
          }

          setError(
            activityError instanceof Error
              ? activityError.message
              : "Failed to load activity",
          );
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      })();

      return () => {
        active = false;
      };
    }, []),
  );

  return (
    <ActivityView
      items={items}
      loading={loading}
      error={error}
      onBack={() => {
        router.back();
      }}
      onSelect={(item) => {
        /*
         * Следующим шагом:
         * /activity/[hash]
         */
        console.log("Activity:", item.hash);
      }}
    />
  );
}
