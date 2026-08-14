import { formatEther, formatUnits } from "viem";

import type { PreparedErc20Approve } from "./erc20Approve";
import type { PreparedSwap } from "./swap";

export type SwapPreview = {
  kind: "swap";

  network: string;

  from: string;

  symbolIn: string;

  amountIn: string;

  symbolOut: string;

  quotedAmountOut: string;

  minAmountOut: string;

  rate: string;

  routeLabel: string;

  slippagePercent: string;

  maximumNetworkFeeEth: string;
};

export type SwapApprovePreview = {
  kind: "swap-approve";

  network: string;

  from: string;

  token: string;

  symbol: string;

  amount: string;

  spender: string;

  maximumNetworkFeeEth: string;
};

function formatFeeTier(fee: number) {
  return `${(fee / 10_000).toString()}%`;
}

export function describeSwapRoute(transaction: PreparedSwap): string {
  if (transaction.route.kind === "single") {
    return `Uniswap V3 · ${formatFeeTier(transaction.route.fee)}`;
  }

  return `Uniswap V3 · via WETH ${formatFeeTier(
    transaction.route.feeIn,
  )} + ${formatFeeTier(transaction.route.feeOut)}`;
}

export function createSwapPreview(
  transaction: PreparedSwap,
  network: string,
): SwapPreview {
  const maximumNetworkFeeWei = transaction.gas * transaction.maxFeePerGas;

  const amountIn = formatUnits(
    transaction.amountIn,
    transaction.assetIn.decimals,
  );

  const quotedOut = formatUnits(
    transaction.quotedAmountOut,
    transaction.assetOut.decimals,
  );

  const rateValue =
    Number(quotedOut) > 0 && Number(amountIn) > 0
      ? Number(quotedOut) / Number(amountIn)
      : null;

  return {
    kind: "swap",

    network,

    from: transaction.from,

    symbolIn: transaction.assetIn.symbol,

    amountIn,

    symbolOut: transaction.assetOut.symbol,

    quotedAmountOut: quotedOut,

    minAmountOut: formatUnits(
      transaction.minAmountOut,
      transaction.assetOut.decimals,
    ),

    rate:
      rateValue === null
        ? "—"
        : `1 ${transaction.assetIn.symbol} ≈ ${rateValue.toLocaleString(
            "en-US",
            {
              maximumSignificantDigits: 6,
            },
          )} ${transaction.assetOut.symbol}`,

    routeLabel: describeSwapRoute(transaction),

    slippagePercent: `${(transaction.slippageBps / 100).toFixed(2)}%`,

    maximumNetworkFeeEth: formatEther(maximumNetworkFeeWei),
  };
}

export function createSwapApprovePreview(
  transaction: PreparedErc20Approve,
  network: string,
): SwapApprovePreview {
  const maximumNetworkFeeWei = transaction.gas * transaction.maxFeePerGas;

  return {
    kind: "swap-approve",

    network,

    from: transaction.from,

    token: transaction.token,

    symbol: transaction.tokenSymbol,

    amount: formatUnits(transaction.amount, transaction.tokenDecimals),

    spender: transaction.spender,

    maximumNetworkFeeEth: formatEther(maximumNetworkFeeWei),
  };
}
