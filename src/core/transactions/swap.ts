import {
  getAddress,
  isAddress,
  zeroAddress,
  type Address,
  type Hex,
} from "viem";

import {
  encodeSwapCalldata,
  type SwapRoute,
  type UniswapDeployment,
} from "@/core/blockchain/uniswap";

import { TransactionValidationError } from "./nativeTransfer";

export type SwapAssetRef = {
  address: Address | null;

  symbol: string;

  decimals: number;
};

export type SwapIntent = {
  kind: "swap";

  chainId: number;

  from: Address;

  assetIn: SwapAssetRef;

  assetOut: SwapAssetRef;

  amountIn: bigint;

  quotedAmountOut: bigint;

  minAmountOut: bigint;

  slippageBps: number;

  route: SwapRoute;

  deadline: bigint;
};

export type PreparedSwap = SwapIntent & {
  type: "eip1559";

  to: Address;

  value: bigint;

  nonce: number;

  gas: bigint;

  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;

  data: Hex;
};

export const MAX_SWAP_DEADLINE_MS = 60 * 60 * 1000;

export type SwapValidationContext = {
  now: number;

  expectedChainId: number;

  expectedFrom: Address;

  deployment: UniswapDeployment;
};

export type PreparedSwapValidationContext = SwapValidationContext & {
  balanceWei: bigint;

  tokenInBalance: bigint;

  tokenInAllowance: bigint;
};

const MAX_SLIPPAGE_BPS = 1_000;

function assertChain(chainId: number, expectedChainId: number) {
  if (
    !Number.isSafeInteger(chainId) ||
    chainId <= 0 ||
    chainId !== expectedChainId
  ) {
    throw new TransactionValidationError(
      "INVALID_CHAIN",
      "Transaction chain does not match active network",
    );
  }
}

function normalizeFrom(address: string, expectedFrom: string): Address {
  if (!isAddress(address) || !isAddress(expectedFrom)) {
    throw new TransactionValidationError("INVALID_FROM", "Invalid sender address");
  }

  const from = getAddress(address);

  if (from.toLowerCase() !== expectedFrom.toLowerCase()) {
    throw new TransactionValidationError(
      "INVALID_FROM",
      "Transaction sender does not match active wallet",
    );
  }

  return from;
}

function normalizeAssetRef(asset: SwapAssetRef, label: string): SwapAssetRef {
  if (asset.address !== null) {
    if (!isAddress(asset.address)) {
      throw new TransactionValidationError(
        "INVALID_TO",
        `Invalid ${label} token address`,
      );
    }

    if (asset.address.toLowerCase() === zeroAddress.toLowerCase()) {
      throw new TransactionValidationError(
        "ZERO_ADDRESS",
        `Invalid ${label} token address`,
      );
    }
  }

  if (
    !Number.isSafeInteger(asset.decimals) ||
    asset.decimals < 0 ||
    asset.decimals > 77
  ) {
    throw new TransactionValidationError(
      "INVALID_DATA",
      `Invalid ${label} token decimals`,
    );
  }

  return {
    address: asset.address === null ? null : getAddress(asset.address),

    symbol: asset.symbol,

    decimals: asset.decimals,
  };
}

export function resolveRouteAddress(
  asset: SwapAssetRef,
  deployment: UniswapDeployment,
): Address {
  return asset.address ?? deployment.weth9;
}

function assertRoute(route: SwapRoute) {
  const tiers = [100, 500, 3000, 10000];

  if (route.kind === "single") {
    if (!tiers.includes(route.fee)) {
      throw new TransactionValidationError("INVALID_DATA", "Unknown pool fee tier");
    }

    return;
  }

  if (route.kind === "via-weth") {
    if (!tiers.includes(route.feeIn) || !tiers.includes(route.feeOut)) {
      throw new TransactionValidationError("INVALID_DATA", "Unknown pool fee tier");
    }

    return;
  }

  throw new TransactionValidationError("INVALID_DATA", "Unknown swap route");
}

export function validateSwapIntent(
  intent: SwapIntent,
  context: SwapValidationContext,
): SwapIntent {
  assertChain(intent.chainId, context.expectedChainId);

  if (intent.kind !== "swap") {
    throw new TransactionValidationError(
      "INVALID_DATA",
      "Unsupported transaction kind",
    );
  }

  const from = normalizeFrom(intent.from, context.expectedFrom);

  const assetIn = normalizeAssetRef(intent.assetIn, "input");

  const assetOut = normalizeAssetRef(intent.assetOut, "output");

  const routeIn = resolveRouteAddress(assetIn, context.deployment);

  const routeOut = resolveRouteAddress(assetOut, context.deployment);

  if (routeIn.toLowerCase() === routeOut.toLowerCase()) {
    throw new TransactionValidationError(
      "INVALID_DATA",
      "Cannot swap an asset for itself",
    );
  }

  if (intent.amountIn <= 0n) {
    throw new TransactionValidationError(
      "INVALID_VALUE",
      "Swap amount must be greater than zero",
    );
  }

  if (intent.quotedAmountOut <= 0n || intent.minAmountOut <= 0n) {
    throw new TransactionValidationError(
      "INVALID_VALUE",
      "Swap quote must be greater than zero",
    );
  }

  if (intent.minAmountOut > intent.quotedAmountOut) {
    throw new TransactionValidationError(
      "INVALID_VALUE",
      "Minimum received cannot exceed the quote",
    );
  }

  if (
    !Number.isSafeInteger(intent.slippageBps) ||
    intent.slippageBps < 0 ||
    intent.slippageBps > MAX_SLIPPAGE_BPS
  ) {
    throw new TransactionValidationError(
      "INVALID_DATA",
      "Slippage is out of the allowed range",
    );
  }

  const expectedMin =
    (intent.quotedAmountOut * BigInt(10_000 - intent.slippageBps)) / 10_000n;

  if (intent.minAmountOut !== expectedMin) {
    throw new TransactionValidationError(
      "INVALID_VALUE",
      "Minimum received does not match the slippage setting",
    );
  }

  assertRoute(intent.route);

  if (intent.deadline <= 0n) {
    throw new TransactionValidationError("INVALID_DATA", "Invalid swap deadline");
  }

  const nowSeconds = BigInt(Math.floor(context.now / 1000));

  if (intent.deadline <= nowSeconds) {
    throw new TransactionValidationError(
      "INVALID_DATA",
      "This swap has already expired",
    );
  }

  if (
    intent.deadline >
    nowSeconds + BigInt(Math.floor(MAX_SWAP_DEADLINE_MS / 1000))
  ) {
    throw new TransactionValidationError(
      "INVALID_DATA",
      "This swap would stay valid for far too long",
    );
  }

  return Object.freeze({
    kind: "swap",

    chainId: intent.chainId,

    from,

    assetIn,

    assetOut,

    amountIn: intent.amountIn,

    quotedAmountOut: intent.quotedAmountOut,

    minAmountOut: intent.minAmountOut,

    slippageBps: intent.slippageBps,

    route: intent.route,

    deadline: intent.deadline,
  });
}

export function validatePreparedSwapForSigning(
  transaction: PreparedSwap,
  context: SwapValidationContext,
): PreparedSwap {
  if (transaction.type !== "eip1559") {
    throw new TransactionValidationError(
      "INVALID_DATA",
      "Unsupported transaction type",
    );
  }

  const validatedIntent = validateSwapIntent(transaction, context);

  const to = isAddress(transaction.to) ? getAddress(transaction.to) : null;

  if (
    !to ||
    to.toLowerCase() !== context.deployment.swapRouter02.toLowerCase()
  ) {
    throw new TransactionValidationError(
      "INVALID_TO",
      "Swap must target the Uniswap router",
    );
  }

  const nativeIn = validatedIntent.assetIn.address === null;

  const expected = encodeSwapCalldata({
    routeTokenIn: resolveRouteAddress(validatedIntent.assetIn, context.deployment),

    routeTokenOut: resolveRouteAddress(
      validatedIntent.assetOut,
      context.deployment,
    ),

    route: validatedIntent.route,

    recipient: validatedIntent.from,

    amountIn: validatedIntent.amountIn,

    minAmountOut: validatedIntent.minAmountOut,

    deadline: validatedIntent.deadline,

    nativeIn,

    nativeOut: validatedIntent.assetOut.address === null,

    weth9: context.deployment.weth9,
  });

  if (transaction.data.toLowerCase() !== expected.data.toLowerCase()) {
    throw new TransactionValidationError(
      "INVALID_DATA",
      "Transaction data does not match the swap intent",
    );
  }

  if (transaction.value !== expected.value) {
    throw new TransactionValidationError(
      "INVALID_VALUE",
      "Transaction value does not match the swap intent",
    );
  }

  if (!Number.isSafeInteger(transaction.nonce) || transaction.nonce < 0) {
    throw new TransactionValidationError(
      "INVALID_NONCE",
      "Invalid transaction nonce",
    );
  }

  if (transaction.gas <= 0n) {
    throw new TransactionValidationError("INVALID_GAS", "Invalid gas limit");
  }

  if (transaction.maxFeePerGas <= 0n) {
    throw new TransactionValidationError(
      "INVALID_MAX_FEE",
      "Invalid maximum network fee",
    );
  }

  if (transaction.maxPriorityFeePerGas < 0n) {
    throw new TransactionValidationError(
      "INVALID_PRIORITY_FEE",
      "Invalid priority fee",
    );
  }

  if (transaction.maxPriorityFeePerGas > transaction.maxFeePerGas) {
    throw new TransactionValidationError(
      "INVALID_FEE_RELATION",
      "Priority fee cannot exceed maximum fee",
    );
  }

  return Object.freeze({
    ...validatedIntent,

    type: "eip1559",

    to,

    value: expected.value,

    nonce: transaction.nonce,

    gas: transaction.gas,

    maxFeePerGas: transaction.maxFeePerGas,

    maxPriorityFeePerGas: transaction.maxPriorityFeePerGas,

    data: expected.data,
  });
}

export function validatePreparedSwap(
  transaction: PreparedSwap,
  context: PreparedSwapValidationContext,
): PreparedSwap {
  const validated = validatePreparedSwapForSigning(transaction, context);

  const maximumNetworkFee = validated.gas * validated.maxFeePerGas;

  if (validated.value + maximumNetworkFee > context.balanceWei) {
    throw new TransactionValidationError(
      "INSUFFICIENT_BALANCE",
      validated.value > 0n
        ? "Insufficient ETH balance for amount and maximum network fee"
        : "Insufficient ETH balance for the network fee",
    );
  }

  if (validated.assetIn.address !== null) {
    if (validated.amountIn > context.tokenInBalance) {
      throw new TransactionValidationError(
        "INSUFFICIENT_BALANCE",
        `Insufficient ${validated.assetIn.symbol} balance`,
      );
    }

    if (validated.amountIn > context.tokenInAllowance) {
      throw new TransactionValidationError(
        "INSUFFICIENT_BALANCE",
        `${validated.assetIn.symbol} allowance is too low — approve first`,
      );
    }
  }

  return validated;
}
