import { useEffect, useState } from "react";

import { ActivityIndicator } from "react-native";

import { useLocalSearchParams, useRouter } from "expo-router";

import type { Hash } from "viem";

import { TransactionDetailsView } from "@/components/screens/transaction-details-view";
import { Screen } from "@/components/ui/screen";
import { AppText } from "@/components/ui/text";

import type { TransactionDetails } from "@/core/transactions/transactionDetails";

import { getTransactionDetails } from "@/platform/react-native/getTransactionDetails";

export default function TransactionDetailsScreen() {
  const router = useRouter();

  const { hash } = useLocalSearchParams<{
    hash: Hash;
  }>();

  const [transaction, setTransaction] = useState<TransactionDetails | null>(
    null,
  );

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        setError(null);

        const result = await getTransactionDetails(hash);

        if (!active) {
          return;
        }

        setTransaction(result);
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load transaction",
        );
      }
    })();

    return () => {
      active = false;
    };
  }, [hash]);

  if (error) {
    return (
      <Screen>
        <AppText variant="caption" tone="danger">
          {error}
        </AppText>
      </Screen>
    );
  }

  if (!transaction) {
    return (
      <Screen>
        <ActivityIndicator />
      </Screen>
    );
  }

  return (
    <TransactionDetailsView
      transaction={transaction}
      onBack={() => {
        if (router.canGoBack()) {
          router.back();
          return;
        }

        router.replace("/activity");
      }}
    />
  );
}
