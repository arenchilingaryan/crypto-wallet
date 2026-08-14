import { Pressable, View } from "react-native";

import { formatEther } from "viem";

import { ExecutionReport } from "@/components/execution-report";
import { BackIcon } from "@/components/icons/back-icon";
import { Screen } from "@/components/ui/screen";
import { AppText } from "@/components/ui/text";

import { Colors } from "@/constants/theme";

import type { TransactionDetails } from "@/core/transactions/transactionDetails";

import { styles } from "./transaction-details-view.styles";

type TransactionDetailsViewProps = {
  transaction: TransactionDetails;

  onBack: () => void;
};

function formatDate(timestamp: number | null) {
  if (!timestamp) {
    return "—";
  }

  return new Date(timestamp).toLocaleString();
}

function DetailRow({
  label,
  value,
  mono = false,
  selectable = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  selectable?: boolean;
}) {
  return (
    <View style={styles.row}>
      <AppText variant="caption" tone="muted">
        {label}
      </AppText>

      <AppText
        variant="bodyStrong"
        mono={mono}
        selectable={selectable}
        style={styles.rowValue}
      >
        {value}
      </AppText>
    </View>
  );
}

export function TransactionDetailsView({
  transaction,
  onBack,
}: TransactionDetailsViewProps) {
  const amount = transaction.displayAmount;

  const fee =
    transaction.networkFeeWei !== null
      ? formatEther(transaction.networkFeeWei)
      : null;

  return (
    <Screen scroll style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          onPress={onBack}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}
        >
          <BackIcon size={22} color={Colors.textPrimary} />
        </Pressable>

        <AppText variant="heading">Transaction</AppText>
      </View>

      <View style={styles.hero}>
        <AppText variant="overline" tone="muted">
          {transaction.status}
        </AppText>

        <AppText variant="display" tabular>
          {amount} {transaction.symbol}
        </AppText>

        {transaction.kind === "approve" && (
          <AppText variant="caption" tone="warning">
            Spending allowance, not an amount that moved
          </AppText>
        )}

        {transaction.kind === "swap" && transaction.symbolOut && (
          <AppText
            variant="caption"
            tone={
              transaction.status === "reverted"
                ? "danger"
                : transaction.amountOutIsQuote
                  ? "muted"
                  : "success"
            }
            tabular
          >
            {transaction.status === "reverted"
              ? `${transaction.symbolOut} not received`
              : !transaction.amountOut
                ? `for ${transaction.symbolOut}`
                : transaction.amountOutIsQuote
                  ? `~${transaction.amountOut} ${transaction.symbolOut} quoted`
                  : `for ${transaction.amountOut} ${transaction.symbolOut}`}
          </AppText>
        )}
      </View>

      <View style={styles.card}>
        <DetailRow label="Status" value={transaction.status} />

        <DetailRow label="Network" value={transaction.network} />

        <DetailRow label="From" value={transaction.from} mono selectable />

        <DetailRow label="To" value={transaction.to ?? "—"} mono selectable />

        <DetailRow label="Network fee" value={fee ? `${fee} ETH` : "Pending"} />

        <DetailRow
          label="Block"
          value={
            transaction.blockNumber !== null
              ? transaction.blockNumber.toString()
              : "Pending"
          }
        />

        <DetailRow label="Time" value={formatDate(transaction.timestamp)} />

        <DetailRow
          label="Transaction hash"
          value={transaction.hash}
          mono
          selectable
        />
      </View>

      {transaction.execution && (
        <ExecutionReport execution={transaction.execution} />
      )}
    </Screen>
  );
}
