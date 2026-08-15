import { useState } from "react";

import { ActivityIndicator, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { ScreenHeader } from "@/components/ui/screen-header";
import { AppText } from "@/components/ui/text";

import {
  allRecordsReadable,
  recordAction,
  type LocalRecordState,
} from "@/core/ui/repairPlan";

import { styles } from "./repair-view.styles";

export type { LocalRecordState };

export type LocalRecord = {
  id: string;

  title: string;

  // What this record is used for, so the cost of resetting it is legible.
  purpose: string;

  // What is lost by starting a fresh one.
  cost: string;

  state: LocalRecordState;

  // False when the record has no "start a new one" answer and the way out
  // lives elsewhere. Defaults to true.
  repairable?: boolean;
};

type RepairViewProps = {
  records: LocalRecord[];

  loading: boolean;

  repairing: string | null;

  error: string | null;

  onRepair: (id: string) => void;

  // How many unreadable copies earlier repairs parked here, and the way to let
  // go of them. Without this the "no free place left" refusal names an action
  // that does not exist.
  keptCopies: number;

  onForgetKeptCopies: () => void;

  onBack: () => void;
};

function describe(state: LocalRecordState) {
  switch (state) {
    case "readable":
      return "Readable";

    case "unreadable":
      return "Cannot be read";

    case "unknown":
      return "Not checked";
  }
}

export function RepairView({
  records,
  loading,
  repairing,
  error,
  onRepair,
  keptCopies,
  onForgetKeptCopies,
  onBack,
}: RepairViewProps) {
  // Which record has been asked about but not yet confirmed. Kept here rather
  // than in a platform dialog: Alert is a no-op on react-native-web, and this
  // is the only way out of a record that cannot be read.
  const [confirming, setConfirming] = useState<string | null>(null);

  const [forgetting, setForgetting] = useState(false);

  const settled = allRecordsReadable(records.map((record) => record.state));

  return (
    <Screen scroll onBack={onBack}>
      <ScreenHeader
        title="Local records"
        subtitle="Records this device keeps for itself. When one cannot be read, this wallet refuses to send rather than act on a record it cannot account for."
      />

      {loading && (
        <View style={styles.loading}>
          <ActivityIndicator />
        </View>
      )}

      {error !== null && (
        <AppText variant="caption" tone="warning" style={styles.notice}>
          {error}
        </AppText>
      )}

      {!loading && settled && (
        <AppText variant="caption" tone="muted" style={styles.notice}>
          Every record below could be read. Nothing here needs repairing.
        </AppText>
      )}

      {records.map((record) => {
        const action = recordAction(
          record.state,
          record.id,
          confirming,
          record.repairable ?? true,
        );

        return (
          <View key={record.id} style={styles.card}>
            <AppText variant="label" tone="paper">
              {record.title}
            </AppText>

            <AppText
              variant="caption"
              tone={record.state === "unreadable" ? "warning" : "secondary"}
              style={styles.state}
            >
              {describe(record.state)}
            </AppText>

            <AppText variant="caption" tone="muted" style={styles.detail}>
              {record.purpose}
            </AppText>

            {record.state === "unreadable" && record.repairable === false && (
              <AppText variant="caption" tone="warning" style={styles.detail}>
                {record.cost}
              </AppText>
            )}

            {record.state === "unknown" && (
              <AppText variant="caption" tone="warning" style={styles.detail}>
                This record could not be checked, so nothing is claimed about it
                either way. Nothing can be repaired until it can be read or
                shown to be unreadable.
              </AppText>
            )}

            {action !== "none" && (
              <>
                <AppText variant="caption" tone="warning" style={styles.detail}>
                  {record.cost}
                </AppText>

                {action === "confirm" && (
                  <AppText
                    variant="caption"
                    tone="warning"
                    style={styles.detail}
                  >
                    This cannot be undone. Press again to start a new record.
                  </AppText>
                )}

                <Button
                  title={
                    repairing === record.id
                      ? "Starting a new record…"
                      : action === "confirm"
                        ? "Yes, start a new record"
                        : "Keep the old one and start a new record"
                  }
                  variant="secondary"
                  disabled={repairing !== null}
                  onPress={() => {
                    if (action === "offer") {
                      setConfirming(record.id);

                      return;
                    }

                    setConfirming(null);

                    onRepair(record.id);
                  }}
                />

                {action === "confirm" && (
                  <Button
                    title="Cancel"
                    variant="ghost"
                    disabled={repairing !== null}
                    onPress={() => {
                      setConfirming(null);
                    }}
                  />
                )}
              </>
            )}
          </View>
        );
      })}

      <AppText variant="caption" tone="muted" style={styles.notice}>
        Repairing never deletes the unreadable record. It is kept on this device
        so it can still be inspected later.
      </AppText>

      {keptCopies > 0 && (
        <View style={styles.card}>
          <AppText variant="label" tone="paper">
            {keptCopies === 1
              ? "1 unreadable copy kept here"
              : `${keptCopies} unreadable copies kept here`}
          </AppText>

          <AppText variant="caption" tone="muted" style={styles.detail}>
            Left by earlier repairs. Nothing reads them; they are here in case
            you or someone helping you wants to look at what was lost.
          </AppText>

          <Button
            title={
              forgetting
                ? "Press again to forget them"
                : "Forget the copies kept here"
            }
            variant="ghost"
            disabled={repairing !== null}
            onPress={() => {
              if (!forgetting) {
                setForgetting(true);

                return;
              }

              setForgetting(false);

              onForgetKeptCopies();
            }}
          />
        </View>
      )}
    </Screen>
  );
}
