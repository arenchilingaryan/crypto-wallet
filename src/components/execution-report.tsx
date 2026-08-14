import { View } from "react-native";

import { AppText } from "@/components/ui/text";

import type { ExecutionAnalysis } from "@/core/transactions/analyzeExecution";

import { styles } from "./execution-report.styles";

function Row({
  label,
  value,
  tone,
}: {
  label: string;

  value: string;

  tone?: "success" | "danger" | "muted" | "secondary";
}) {
  return (
    <View style={styles.row}>
      <AppText variant="caption" tone="muted">
        {label}
      </AppText>

      <AppText
        variant="bodyStrong"
        tone={tone}
        tabular
        style={styles.value}
      >
        {value}
      </AppText>
    </View>
  );
}

export function ExecutionReport({
  execution,
}: {
  execution: ExecutionAnalysis;
}) {
  return (
    <View style={styles.card}>
      <AppText variant="overline" tone="muted">
        Execution
      </AppText>

      <Row
        label="You paid"
        value={`${execution.amountIn} ${execution.symbolIn}`}
      />

      {execution.quoted && (
        <Row
          label="Quoted"
          value={`${execution.quoted} ${execution.symbolOut}`}
        />
      )}

      {execution.minimum && (
        <Row
          label="Your floor"
          value={`${execution.minimum} ${execution.symbolOut}`}
        />
      )}

      {execution.received && (
        <Row
          label="Received"
          value={`${execution.received} ${execution.symbolOut}`}
        />
      )}

      {execution.deviation && (
        <>
          <View style={styles.divider} />

          <Row
            label="Against the quote"
            value={`${execution.deviation.amount} ${execution.symbolOut}`}
            tone={execution.deviation.worseThanQuote ? "danger" : "success"}
          />
        </>
      )}

      {execution.gasNative && (
        <Row
          label="Network fee"
          value={`${execution.gasNative} ${execution.nativeSymbol}`}
        />
      )}

      {execution.secondsToConfirm !== null && (
        <Row
          label="Time to confirm"
          value={`${execution.secondsToConfirm}s`}
          tone="secondary"
        />
      )}

      {execution.unresolved.length > 0 && (
        <AppText variant="caption" tone="muted">
          Not established: {execution.unresolved.join(", ")}. This wallet shows
          nothing it cannot read from the chain.
        </AppText>
      )}
    </View>
  );
}
