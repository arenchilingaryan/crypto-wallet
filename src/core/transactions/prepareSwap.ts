import type { PublicClient } from "viem";

import { erc20Abi } from "@/core/blockchain/erc20Abi";
import {
  encodeSwapCalldata,
  type UniswapDeployment,
} from "@/core/blockchain/uniswap";

import { TransactionValidationError } from "./nativeTransfer";
import {
  resolveRouteAddress,
  validatePreparedSwap,
  validateSwapIntent,
  type PreparedSwap,
  type SwapIntent,
  type SwapValidationContext,
} from "./swap";

export async function prepareSwap(
  intent: SwapIntent,
  context: SwapValidationContext,
  client: PublicClient,
): Promise<PreparedSwap> {
  const rpcChainId = await client.getChainId();

  if (rpcChainId !== context.expectedChainId) {
    throw new TransactionValidationError(
      "INVALID_CHAIN",
      "RPC network does not match expected network",
    );
  }

  const validatedIntent = validateSwapIntent(intent, context);

  const deployment: UniswapDeployment = context.deployment;

  const nativeIn = validatedIntent.assetIn.address === null;

  const { data, value } = encodeSwapCalldata({
    routeTokenIn: resolveRouteAddress(validatedIntent.assetIn, deployment),

    routeTokenOut: resolveRouteAddress(validatedIntent.assetOut, deployment),

    route: validatedIntent.route,

    recipient: validatedIntent.from,

    amountIn: validatedIntent.amountIn,

    minAmountOut: validatedIntent.minAmountOut,

    deadline: validatedIntent.deadline,

    nativeIn,

    nativeOut: validatedIntent.assetOut.address === null,

    weth9: deployment.weth9,
  });

  const tokenIn = validatedIntent.assetIn.address;

  const [balanceWei, tokenInBalance, tokenInAllowance, nonce, gas, fees] =
    await Promise.all([
      client.getBalance({
        address: validatedIntent.from,
        blockTag: "pending",
      }),

      tokenIn === null
        ? Promise.resolve(0n)
        : client.readContract({
            address: tokenIn,

            abi: erc20Abi,

            functionName: "balanceOf",

            args: [validatedIntent.from],
          }),

      tokenIn === null
        ? Promise.resolve(0n)
        : client.readContract({
            address: tokenIn,

            abi: erc20Abi,

            functionName: "allowance",

            args: [validatedIntent.from, deployment.swapRouter02],
          }),

      client.getTransactionCount({
        address: validatedIntent.from,
        blockTag: "pending",
      }),

      client.estimateGas({
        account: validatedIntent.from,

        to: deployment.swapRouter02,

        value,

        data,
      }),

      client.estimateFeesPerGas(),
    ]);

  const transaction: PreparedSwap = {
    ...validatedIntent,

    type: "eip1559",

    to: deployment.swapRouter02,

    value,

    nonce,

    gas,

    maxFeePerGas: fees.maxFeePerGas,

    maxPriorityFeePerGas: fees.maxPriorityFeePerGas,

    data,
  };

  return validatePreparedSwap(transaction, {
    ...context,

    balanceWei,

    tokenInBalance,

    tokenInAllowance,
  });
}
