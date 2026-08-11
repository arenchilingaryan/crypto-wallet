import { useCallback, useState } from "react";

import { useFocusEffect, useRouter } from "expo-router";

import { ActivityView } from "@/components/screens/activity-view";

import type { ActivityItem } from "@/core/blockchain/activity";

import { getActivity } from "@/core/blockchain/getActivity";

import { mergeActivity } from "@/core/blockchain/mergeActivity";

import { trackedTransactionApi } from "@/platform/react-native/trackedTransactionApi";

import { walletApi } from "@/platform/react-native/walletApi";

export default function ActivityScreen() {
  const [items, setItems] = useState<ActivityItem[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const router = useRouter();

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

          const tracked = await trackedTransactionApi.refreshPending();

          const chainActivity = await getActivity(wallet.address);

          if (!active) {
            return;
          }

          setItems(mergeActivity(chainActivity, tracked, wallet.address));
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
      onSelect={(item) => {
        router.push({
          pathname: "/activity/[hash]",

          params: {
            hash: item.hash,
          },
        });
      }}
    />
  );
}
