import { View } from "react-native";

import { AppText } from "@/components/ui/text";

import type { ExecutionAnalysis } from "@/core/transactions/analyzeExecution";
import type { StoryStep } from "@/core/transactions/executionStory";

import { styles } from "./execution-report.styles";

const STORY_MARK: Record<StoryStep["state"], string> = {
  done: "✓",
  waiting: "…",
  failed: "✕",
  unknown: "?",
};

const STORY_TONE: Record<
  StoryStep["state"],
  "success" | "muted" | "danger" | "warning"
> = {
  done: "success",
  waiting: "muted",
  failed: "danger",
  unknown: "warning",
};

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

      <AppText variant="bodyStrong" tone={tone} tabular style={styles.value}>
        {value}
      </AppText>
    </View>
  );
}

export function ExecutionStory({ steps }: { steps: StoryStep[] }) {
  return (
    <View style={styles.card}>
      <AppText variant="overline" tone="muted">
        What happened
      </AppText>

      {steps.map((step) => (
        <View key={step.id} style={styles.step}>
          <AppText
            variant="bodyStrong"
            tone={STORY_TONE[step.state]}
            style={styles.mark}
          >
            {STORY_MARK[step.state]}
          </AppText>

          <View style={styles.stepText}>
            <AppText variant="body">{step.title}</AppText>

            {step.detail && (
              <AppText variant="caption" tone="muted">
                {step.detail}
              </AppText>
            )}
          </View>
        </View>
      ))}
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
            value={
              execution.deviation.amount === "0"
                ? "exactly as quoted"
                : `${execution.deviation.amount} ${execution.symbolOut}`
            }
            tone={execution.deviation.worseThanQuote ? "danger" : "success"}
          />
        </>
      )}

      {execution.headroomOverFloor && (
        <Row
          label="Above your floor"
          value={`${execution.headroomOverFloor} ${execution.symbolOut}`}
          tone="secondary"
        />
      )}

      {execution.executionPrice && (
        <Row
          label="Price you got"
          value={`${execution.executionPrice} ${execution.symbolOut} per ${execution.symbolIn}`}
        />
      )}

      <View style={styles.divider} />

      {execution.gasNative && (
        <Row
          label="Network fee"
          value={`${execution.gasNative} ${execution.nativeSymbol}`}
        />
      )}

      {execution.gasUsed && (
        <Row
          label="Gas used"
          value={
            execution.gasHeadroomPercent === null
              ? execution.gasUsed
              : `${execution.gasUsed} of the ${execution.gasLimit} you allowed`
          }
          tone="secondary"
        />
      )}

      {execution.route && <Row label="Route" value={execution.route} />}

      {execution.secondsToConfirm !== null && (
        <Row
          label="Quote to block"
          value={`${execution.secondsToConfirm}s`}
          tone="secondary"
        />
      )}

      <AppText variant="caption" tone="muted">
        {execution.provenance === "receipt-logs"
          ? `What you received was read from the transaction receipt, not from the quote.`
          : `Not established: ${execution.unresolved.join(", ")}. This wallet shows nothing it cannot read from the chain.`}
      </AppText>
    </View>
  );
}
