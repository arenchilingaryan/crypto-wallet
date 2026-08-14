import type { Address, Hash } from "viem";

export type ActivityDirection = "sent" | "received" | "self";

export function resolveDirection(
  from: string,
  to: string | null,
  owner: string,
): ActivityDirection {
  const wallet = owner.toLowerCase();

  const sender = from.toLowerCase() === wallet;

  const recipient = to !== null && to.toLowerCase() === wallet;

  if (sender && recipient) {
    return "self";
  }

  return sender ? "sent" : "received";
}

export function isOutflow(direction: ActivityDirection) {
  return direction === "sent";
}

export function provesRecipientWasChosen(item: ActivityItem) {
  if (!isOutflow(item.direction) || item.to === null) {
    return false;
  }

  return item.origin === "wallet-signed" || item.origin === "native-transfer";
}

export type ActivityPresentation = {
  title: string;

  counterparty: Address | null;

  counterpartyLabel: string | null;

  amountSign: "-" | "+" | "";

  note: string | null;
};

export function presentActivity(item: ActivityItem): ActivityPresentation {
  if (item.assetType === "swap") {
    return {
      title: `Swapped ${item.symbol} → ${item.symbolOut ?? "?"}`,
      counterparty: null,
      counterpartyLabel: null,
      amountSign: "-",
      note: null,
    };
  }

  if (item.assetType === "approve") {
    return {
      title: `Approved ${item.symbol}`,
      counterparty: null,
      counterpartyLabel: null,
      amountSign: "",
      note: null,
    };
  }

  switch (item.direction) {
    case "self":
      return {
        title: `Moved ${item.symbol} to yourself`,
        counterparty: null,
        counterpartyLabel: null,
        amountSign: "",
        note: "Nothing left this wallet apart from the network fee",
      };

    case "sent":
      return {
        title: `Sent ${item.symbol}`,
        counterparty: item.to,
        counterpartyLabel: "To",
        amountSign: "-",
        note: null,
      };

    case "received":
      return {
        title: `Received ${item.symbol}`,
        counterparty: item.from,
        counterpartyLabel: "From",
        amountSign: "+",
        note: null,
      };
  }
}

export type ActivityStatus =
  | "broadcast-pending"
  | "broadcast-unknown"
  | "pending"
  | "confirmed"
  | "reverted";

export type ActivityOrigin = "wallet-signed" | "native-transfer" | "token-log";

export type ActivityItem = {
  id: string;

  hash: Hash;

  status: ActivityStatus;

  direction: ActivityDirection;

  origin: ActivityOrigin;

  assetType: "native" | "erc20" | "swap" | "approve";

  symbol: string;

  amount: string;

  from: Address;

  to: Address | null;

  contractAddress: Address | null;

  blockNumber: bigint | null;

  timestamp: number | null;

  symbolOut?: string;

  amountOut?: string;

  amountOutIsQuote?: boolean;
};
