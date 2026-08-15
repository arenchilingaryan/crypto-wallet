export type LocalRecordState = "readable" | "unreadable" | "unknown";

// What the screen may offer for one record.
//   none    — nothing to do, or nothing we know enough to do
//   offer   — the repair is available and has not been asked for yet
//   confirm — the user asked; this is the second, deliberate press
export type RecordAction = "none" | "offer" | "confirm";

// A two-step press on the screen itself rather than a modal: the platform
// dialog is a no-op on react-native-web, which would leave the only way out of
// an unreadable record silently doing nothing.
export function recordAction(
  state: LocalRecordState,
  recordId: string,
  confirmingId: string | null,
  // Some records are unreadable but have no "start a new one" answer — the
  // signing lockdown is lifted through its own flow, not by being replaced.
  // Offering a button that does nothing is worse than offering none.
  repairable = true,
): RecordAction {
  if (state !== "unreadable" || !repairable) {
    return "none";
  }

  return confirmingId === recordId ? "confirm" : "offer";
}

// "Nothing needs repairing" is a claim about every record, so a record nobody
// managed to check cannot contribute to it.
export function allRecordsReadable(states: LocalRecordState[]): boolean {
  return states.length > 0 && states.every((state) => state === "readable");
}
