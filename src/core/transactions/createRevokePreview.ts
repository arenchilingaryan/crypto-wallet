import { formatEther } from "viem";

import type { PreparedErc20Revoke } from "./erc20Revoke";

export type RevokePreview = {
  kind: "revoke";

  network: string;

  from: string;

  token: string;

  symbol: string;

  spender: string;

  spenderName: string;

  maximumNetworkFeeEth: string;
};

export function createRevokePreview(
  transaction: PreparedErc20Revoke,
  network: string,
): RevokePreview {
  const maximumNetworkFeeWei = transaction.gas * transaction.maxFeePerGas;

  return {
    kind: "revoke",

    network,

    from: transaction.from,

    token: transaction.token,

    symbol: transaction.tokenSymbol,

    spender: transaction.spender,

    spenderName: transaction.spenderName,

    maximumNetworkFeeEth: formatEther(maximumNetworkFeeWei),
  };
}
