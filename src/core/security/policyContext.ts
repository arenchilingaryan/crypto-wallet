import { formatUnits, type Address } from "viem";

import {
  provesRecipientWasChosen,
  type ActivityItem,
} from "@/core/blockchain/activity";
import {
  countsAgainstOutflow,
  type TrackedTransaction,
} from "@/core/transactions/trackedTransaction";

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

    if (typeof item.valueUsd === "number" && Number.isFinite(item.valueUsd)) {
      return total + item.valueUsd;
    }

    const price = priceOf(item.symbol);

    if (price === null) {
      return total;
    }

    const amount = Number(
      formatUnits(BigInt(item.valueWei), item.tokenDecimals ?? 18),
    );

    if (!Number.isFinite(amount)) {
      return total;
    }

    return total + amount * price;
  }, 0);
}
