import { useCallback, useState } from "react";

import { useFocusEffect } from "expo-router";

import { goBack } from "@/utils/navigation";

import {
  RepairView,
  type LocalRecord,
} from "@/components/screens/repair-view";

import { outflowGuardApi } from "@/platform/react-native/outflowGuardApi";
import { panicApi } from "@/platform/react-native/panicApi";
import {
  forgetKeptUnreadableRecords,
  keptUnreadableRecords,
  quarantineTrackedTransactions,
  trackedTransactionsReadable,
} from "@/platform/react-native/trackedTransactionStore";

const TRANSACTIONS = "transactions";
const RESERVATIONS = "reservations";
const LOCKDOWN = "lockdown";

function describeRecords(
  transactions: LocalRecord["state"],
  reservations: LocalRecord["state"],
  lockdown: LocalRecord["state"],
): LocalRecord[] {
  return [
    {
      id: TRANSACTIONS,

      title: "Recent transactions",

      purpose:
        "Every transfer is written here before it is broadcast, and today's outflow is counted from it. While it cannot be read, nothing can be sent.",

      cost: "Starting a new record resets what this device can count towards your daily limit, and the transactions it held disappear from Activity.",

      state: transactions,
    },

    {
      id: RESERVATIONS,

      title: "Transfers awaiting signature",

      purpose:
        "Short-lived holds that stop two transfers being signed against the same remaining daily limit.",

      cost: "Starting a new record releases every hold, so a transfer still being signed will no longer be counted against today's limit.",

      state: reservations,
    },

    {
      id: LOCKDOWN,

      title: "Signing lockdown",

      purpose:
        "Whether you have locked this device out of signing. While it cannot be read, nothing can be signed at all.",

      cost: "Lifting it still takes your PIN, a cooldown and your PIN again — that is on the Security tab. There is nothing to reset here.",

      state: lockdown,

      repairable: false,
    },
  ];
}

export default function RepairScreen() {
  const [transactions, setTransactions] =
    useState<LocalRecord["state"]>("unknown");

  const [reservations, setReservations] =
    useState<LocalRecord["state"]>("unknown");


  const [lockdown, setLockdown] =
    useState<LocalRecord["state"]>("unknown");

  const [loading, setLoading] = useState(true);

  const [repairing, setRepairing] = useState<string | null>(null);

  const [keptCopies, setKeptCopies] = useState(0);

  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [
        transactionsReadable,
        reservationsReadable,
        lockdownReadable,
        keptTransactions,
        keptReservations,
      ] = await Promise.all([
        trackedTransactionsReadable(),

        outflowGuardApi.readable(),

        panicApi.readable(),

        keptUnreadableRecords(),

        outflowGuardApi.keptCopies(),
      ]);

      setTransactions(transactionsReadable ? "readable" : "unreadable");

      setReservations(reservationsReadable ? "readable" : "unreadable");

      setLockdown(lockdownReadable ? "readable" : "unreadable");

      setKeptCopies(keptTransactions.length + keptReservations.length);
    } catch (checkError) {
      console.error("Local record check failed:", checkError);

      // The check itself failing is not evidence either way.
      setTransactions("unknown");
      setReservations("unknown");
      setLockdown("unknown");

      setError("These records could not be checked on this device.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return (
    <RepairView
      records={describeRecords(transactions, reservations, lockdown)}
      loading={loading}
      repairing={repairing}
      error={error}
      // The screen asks for a second, deliberate press before calling this.
      onRepair={(id) => {
        void (async () => {
          try {
            setRepairing(id);
            setError(null);

            if (id === TRANSACTIONS) {
              await quarantineTrackedTransactions();
            } else {
              await outflowGuardApi.quarantine();
            }

            await refresh();
          } catch (repairError) {
            console.error("Repairing a local record failed:", repairError);

            setError(
              repairError instanceof Error
                ? repairError.message
                : "The record could not be replaced.",
            );
          } finally {
            setRepairing(null);
          }
        })();
      }}
      keptCopies={keptCopies}
      onForgetKeptCopies={() => {
        void (async () => {
          try {
            setError(null);

            await forgetKeptUnreadableRecords();

            await outflowGuardApi.forgetKeptCopies();

            await refresh();
          } catch (forgetError) {
            console.error("Forgetting kept copies failed:", forgetError);

            setError("The kept copies could not be removed.");
          }
        })();
      }}
      onBack={() => {
        goBack("/settings");
      }}
    />
  );
}
