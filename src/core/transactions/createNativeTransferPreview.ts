import { formatEther } from "viem";

import type { PreparedNativeTransfer } from "./nativeTransfer";

export type NativeTransferPreview = {
  kind: "native";

  network: string;

  from: string;
  to: string;

  amountEth: string;

  maximumNetworkFeeEth: string;
  maximumTotalEth: string;
};

export function createNativeTransferPreview(
  transaction: PreparedNativeTransfer,
  network: string,
): NativeTransferPreview {
  const maximumNetworkFeeWei = transaction.gas * transaction.maxFeePerGas;

  const maximumTotalWei = transaction.value + maximumNetworkFeeWei;

  return {
    kind: "native",

    network,

    from: transaction.from,
    to: transaction.to,

    amountEth: formatEther(transaction.value),

    maximumNetworkFeeEth: formatEther(maximumNetworkFeeWei),

    maximumTotalEth: formatEther(maximumTotalWei),
  };
}
