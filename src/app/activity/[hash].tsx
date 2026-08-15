import { useEffect, useState } from "react";

import { ActivityIndicator } from "react-native";

import { useLocalSearchParams, useRouter } from "expo-router";

import { goBack } from "@/utils/navigation";

import type { Hash } from "viem";

import { TransactionDetailsView } from "@/components/screens/transaction-details-view";
import { Screen } from "@/components/ui/screen";
import { AppText } from "@/components/ui/text";

import type { TransactionDetails } from "@/core/transactions/transactionDetails";

import { getTransactionDetails } from "@/platform/react-native/getTransactionDetails";

export default function TransactionDetailsScreen() {
  const router = useRouter();

  const {
    hash,
    symbol,
    amount,
    assetType,
    symbolOut,
    amountOut,
    amountOutIsQuote,
  } =
    useLocalSearchParams<{
      symbol?: string;
      amount?: string;
      assetType?: string;
      symbolOut?: string;
      amountOut?: string;
      amountOutIsQuote?: string;
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

        const result = await getTransactionDetails(hash, {
          symbol,
          amount,
          assetType,
          symbolOut,
          amountOut,
          amountOutIsQuote: amountOutIsQuote === "1",
        });

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
  }, [hash, symbol, amount, assetType, symbolOut, amountOut, amountOutIsQuote]);

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
          goBack("/activity");
          return;
        }

        router.replace("/activity");
      }}
    />
  );
}
