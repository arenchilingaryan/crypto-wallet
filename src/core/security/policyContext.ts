import { formatUnits, type Address } from "viem";

import {
  provesRecipientWasChosen,
  type ActivityItem,
} from "@/core/blockchain/activity";
import {
  countsAgainstOutflow,
  type TrackedTransaction,
} from "@/core/transactions/trackedTransaction";
import {
  isDecimalString,
  toBigIntOrNull,
} from "@/core/storage/decimalString";

import type { PolicyContext } from "./securityPolicy";

const DAY_MS = 24 * 60 * 60 * 1000;

type BuildContextInput = {
  owner: Address;

  activity: ActivityItem[];

  tracked: TrackedTransaction[];

  priceOf: (symbol: string) => number | null;

  now?: number;
};

export function buildPolicyContext({
  owner,
  activity,
  tracked,
  priceOf,
  now = Date.now(),
}: BuildContextInput): PolicyContext {
  const ownerAddress = owner.toLowerCase();

  const knownRecipients = new Set<string>();

  for (const item of activity) {
    if (!provesRecipientWasChosen(item) || !item.to) {
      continue;
    }

    if (item.from.toLowerCase() !== ownerAddress) {
      continue;
    }

    knownRecipients.add(item.to.toLowerCase());
  }

  for (const item of tracked) {
    // Only transfers name a recipient the user chose; an approve's `to` is a
    // token contract and a swap's `to` is a router, which must not count as a
    // known recipient.
    if (item.assetType !== "native" && item.assetType !== "erc20") {
      continue;
    }

    if (item.from.toLowerCase() !== ownerAddress) {
      continue;
    }

    if (item.to.toLowerCase() === ownerAddress) {
      continue;
    }

    if (item.status !== "confirmed") {
      continue;
    }

    // A local record saying "confirmed" is this device's own claim. The
    // chain branch above demands proof that the transaction was mined; this
    // one must too, or anything that can write local storage can make an
    // unknown address look familiar and walk past the first-transfer limit.
    if (!confirmedOnChain(item)) {
      continue;
    }

    knownRecipients.add(item.to.toLowerCase());
  }

  const spentTodayUsd = sumTrackedOutflowUsd({
    owner,
    tracked,
    priceOf,
    now,
  });

  return {
    knownRecipients: [...knownRecipients],

    spentTodayUsd,
  };
}

// The parts of a local record that only the chain can produce. A record
// invented in storage can claim any status; it cannot claim a block it was
// mined in and the gas it actually used.
export function confirmedOnChain(item: TrackedTransaction): boolean {
  return (
    isDecimalString(item.blockNumber) &&
    isDecimalString(item.gasUsed) &&
    typeof item.confirmedAt === "number" &&
    Number.isFinite(item.confirmedAt)
  );
}

function countsAsOutflow(
  item: TrackedTransaction,
  ownerAddress: string,
  now: number,
) {
  if (!countsAgainstOutflow(item.status) || now - item.createdAt > DAY_MS) {
    return false;
  }

  if (item.assetType !== "native" && item.assetType !== "erc20") {
    return false;
  }

  return item.to.toLowerCase() !== ownerAddress;
}

export function countUnvaluedOutflows({
  owner,
  tracked,
  now = Date.now(),
}: {
  owner: Address;

  tracked: TrackedTransaction[];

  now?: number;
}): number {
  const ownerAddress = owner.toLowerCase();

  return tracked.filter(
    (item) =>
      countsAsOutflow(item, ownerAddress, now) &&
      !(typeof item.valueUsd === "number" && Number.isFinite(item.valueUsd)),
  ).length;
}

export function sumTrackedOutflowUsd({
  owner,
  tracked,
  priceOf,
  now = Date.now(),
}: {
  owner: Address;

  tracked: TrackedTransaction[];

  priceOf: (symbol: string) => number | null;

  now?: number;
}): number {
  const ownerAddress = owner.toLowerCase();

  return tracked.reduce((total, item) => {
    if (!countsAsOutflow(item, ownerAddress, now)) {
      return total;
    }

    // Clamped at zero: a stored negative would subtract from today's spending
    // and hand back limit that was already used. Money left this wallet or it
    // did not; it never came back through an outflow record.
    if (typeof item.valueUsd === "number" && Number.isFinite(item.valueUsd)) {
      return total + Math.max(0, item.valueUsd);
    }

    const price = priceOf(item.symbol);

    if (price === null) {
      return total;
    }

    const wei = toBigIntOrNull(item.valueWei);

    if (wei === null) {
      return total;
    }

    const amount = Number(formatUnits(wei, item.tokenDecimals ?? 18));

    if (!Number.isFinite(amount)) {
      return total;
    }

    return total + amount * price;
  }, 0);
}
