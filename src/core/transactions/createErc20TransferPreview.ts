import { formatEther, formatUnits } from "viem";

import type { PreparedErc20Transfer } from "./erc20Transfer";

export type Erc20TransferPreview = {
  kind: "erc20";

  network: string;

  from: string;

  to: string;

  token: string;

  symbol: string;

  amountToken: string;

  maximumNetworkFeeEth: string;
};

export function createErc20TransferPreview(
  transaction: PreparedErc20Transfer,
  network: string,
): Erc20TransferPreview {
  const maximumNetworkFeeWei = transaction.gas * transaction.maxFeePerGas;

  return {
    kind: "erc20",

    network,

    from: transaction.from,

    to: transaction.recipient,

    token: transaction.token,

    symbol: transaction.tokenSymbol,

    amountToken: formatUnits(transaction.amount, transaction.tokenDecimals),

    maximumNetworkFeeEth: formatEther(maximumNetworkFeeWei),
  };
}
