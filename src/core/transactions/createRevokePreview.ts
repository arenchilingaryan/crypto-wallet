import { formatEther } from "viem";

import type { PreparedErc20Revoke } from "./erc20Revoke";
import type { PreparedPermit2Revoke } from "./permit2Revoke";

export type RevokePreview = {
  kind: "revoke";

  channel: "erc20" | "permit2";

  network: string;

  from: string;

  token: string;

  symbol: string;

  spender: string;

  spenderName: string;

  maximumNetworkFeeEth: string;
};

export function createRevokePreview(
  transaction: PreparedErc20Revoke | PreparedPermit2Revoke,
  network: string,
): RevokePreview {
  const maximumNetworkFeeWei = transaction.gas * transaction.maxFeePerGas;

  return {
    kind: "revoke",

    channel: transaction.kind === "permit2-revoke" ? "permit2" : "erc20",

    network,

    from: transaction.from,

    token: transaction.token,

    symbol: transaction.tokenSymbol,

    spender: transaction.spender,

    spenderName: transaction.spenderName,

    maximumNetworkFeeEth: formatEther(maximumNetworkFeeWei),
  };
}
