import type { TrackedTransactionStatus } from "./trackedTransaction";

export type StoryState = "done" | "waiting" | "failed" | "unknown";

export type StoryStep = {
  id: string;

  title: string;

  detail: string | null;

  at: number | null;

  state: StoryState;
};

export type StoryKind = "swap" | "transfer" | "approve";

export type ExecutionStoryInput = {
  kind: StoryKind;

  status: TrackedTransactionStatus;

  quotedAt: number | null;

  broadcastAt: number | null;

  confirmedAt: number | null;

  blockNumber: string | null;

  hash: string;
};

function secondsBetween(from: number | null, to: number | null) {
  if (from === null || to === null || to < from) {
    return null;
  }

  return Math.round((to - from) / 1000);
}

function gap(from: number | null, to: number | null) {
  const seconds = secondsBetween(from, to);

  return seconds === null ? null : `${seconds}s later`;
}

export function buildExecutionStory(input: ExecutionStoryInput): StoryStep[] {
  const reachedChain =
    input.status === "pending" ||
    input.status === "confirmed" ||
    input.status === "reverted";

  const steps: StoryStep[] = [
    {
      id: "quoted",
      title:
        input.kind === "swap"
          ? "Quoted and signed"
          : input.kind === "approve"
            ? "Permission signed"
            : "Signed on this device",
      detail: null,
      at: input.quotedAt,
      state: "done",
    },
    {
      id: "recorded",
      title: "Recorded on this device",
      detail: "Saved before the transaction was sent.",
      at: input.quotedAt,
      state: "done",
    },
  ];

  if (input.status === "broadcast-pending") {
    steps.push({
      id: "sent",
      title: "Being sent to the network",
      detail: "This wallet will keep resending it until the chain answers.",
      at: null,
      state: "waiting",
    });

    return steps;
  }

  if (input.status === "superseded") {
    steps.push({
      id: "sent",
      title: "Superseded before confirmation",
      detail:
        "Another transaction used this nonce. This one was not included in a block, so no network fee was paid for it.",
      at: null,
      state: "failed",
    });

    return steps;
  }

  if (input.status === "broadcast-unknown") {
    steps.push({
      id: "sent",
      title: "The network never answered",
      detail:
        "It may or may not have arrived. This wallet keeps checking, and keeps counting the amount as spent until it knows.",
      at: null,
      state: "unknown",
    });

    return steps;
  }

  steps.push({
    id: "sent",
    title: "Sent to the network",
    detail: gap(input.quotedAt, input.broadcastAt),
    at: input.broadcastAt,
    state: "done",
  });

  if (!reachedChain) {
    return steps;
  }

  if (input.status === "pending") {
    steps.push({
      id: "mined",
      title: "Waiting to be included in a block",
      detail: null,
      at: null,
      state: "waiting",
    });

    return steps;
  }

  steps.push({
    id: "mined",
    title:
      input.status === "confirmed"
        ? `Included in block ${input.blockNumber ?? "?"}`
        : "Included in a block, but the call failed",
    detail:
      gap(input.broadcastAt ?? input.quotedAt, input.confirmedAt) ??
      (input.status === "reverted"
        ? "Nothing moved apart from the network fee."
        : null),
    at: input.confirmedAt,
    state: input.status === "confirmed" ? "done" : "failed",
  });

  return steps;
}
