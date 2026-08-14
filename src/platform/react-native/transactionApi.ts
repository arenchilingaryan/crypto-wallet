import { ACTIVE_NETWORK } from "@/constants/networks";
import { keccak256, type Address, type Hash, type Hex } from "viem";

import { erc20Abi } from "@/core/blockchain/erc20Abi";
import { getApprovals } from "@/core/blockchain/getApprovals";
import type { PortfolioAsset } from "@/core/blockchain/getPortfolio";
import { prepareErc20Revoke } from "@/core/transactions/prepareErc20Revoke";
import { preparePermit2Revoke } from "@/core/transactions/preparePermit2Revoke";
import {
  encodeSwapCalldata,
  getUniswapDeployment,
  quoteBestSwapRoute,
  type SwapRoute,
} from "@/core/blockchain/uniswap";
import type { Erc20ApproveIntent } from "@/core/transactions/erc20Approve";
import {
  encodeErc20Transfer,
  type Erc20TransferIntent,
} from "@/core/transactions/erc20Transfer";
import type { NativeTransferIntent } from "@/core/transactions/nativeTransfer";
import { prepareErc20Approve } from "@/core/transactions/prepareErc20Approve";
import { prepareErc20Transfer } from "@/core/transactions/prepareErc20Transfer";
import { prepareNativeTransfer } from "@/core/transactions/prepareNativeTransfer";
import { prepareSwap } from "@/core/transactions/prepareSwap";
import {
  resolveRouteAddress,
  type SwapAssetRef,
  type SwapIntent,
} from "@/core/transactions/swap";
import { walletEngine } from "./compositionRoot";

import { ethereumPublicClient } from "./ethereumPublicClient";

type PrepareNativeTransferInput = {
  to: Address;
  value: bigint;
};

type Erc20TransferInput = {
  token: Address;

  to: Address;

  amount: bigint;

  tokenSymbol: string;

  tokenDecimals: number;
};

export type Erc20TransferQuote = {
  ethBalanceWei: bigint;

  tokenBalance: bigint;

  gas: bigint;

  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;

  maximumNetworkFeeWei: bigint;

  hasSufficientTokenBalance: boolean;
  hasSufficientEthForFee: boolean;
};

export type NativeTransferQuote = {
  balanceWei: bigint;

  gas: bigint;

  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;

  maximumNetworkFeeWei: bigint;
  maximumTotalWei: bigint;

  hasSufficientBalance: boolean;
};

export const SWAP_SLIPPAGE_BPS = 50;

export const SWAP_DEADLINE_MINUTES = 15;

const SWAP_DEADLINE_SECONDS = SWAP_DEADLINE_MINUTES * 60;

type SwapQuoteInput = {
  assetIn: SwapAssetRef;

  assetOut: SwapAssetRef;

  amountIn: bigint;
};

export type SwapQuote = {
  route: SwapRoute;

  quotedAmountOut: bigint;

  minAmountOut: bigint;

  ethBalanceWei: bigint;

  tokenInBalance: bigint;

  needsApproval: boolean;

  gas: bigint;

  gasIsExact: boolean;

  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;

  maximumNetworkFeeWei: bigint;

  hasSufficientBalance: boolean;

  hasSufficientEthForFee: boolean;
};

function requireDeployment() {
  const deployment = getUniswapDeployment(ACTIVE_NETWORK.id);

  if (!deployment) {
    throw new Error(`Swaps are not supported on ${ACTIVE_NETWORK.name}`);
  }

  return deployment;
}

export const transactionApi = {
  async quoteNativeTransfer({
    to,
    value,
  }: PrepareNativeTransferInput): Promise<NativeTransferQuote> {
    const activeWallet = await walletEngine.getActive();

    if (!activeWallet) {
      throw new Error("Active wallet not found");
    }

    const rpcChainId = await ethereumPublicClient.getChainId();

    if (rpcChainId !== ACTIVE_NETWORK.chain.id) {
      throw new Error(`RPC network does not match ${ACTIVE_NETWORK.name}`);
    }

    const [balanceWei, fees] = await Promise.all([
      ethereumPublicClient.getBalance({
        address: activeWallet.address,

        blockTag: "pending",
      }),

      ethereumPublicClient.estimateFeesPerGas(),
    ]);

    if (value >= balanceWei) {
      return {
        balanceWei,

        gas: 0n,

        maxFeePerGas: fees.maxFeePerGas,

        maxPriorityFeePerGas: fees.maxPriorityFeePerGas,

        maximumNetworkFeeWei: 0n,

        maximumTotalWei: value,

        hasSufficientBalance: false,
      };
    }

    const gas = await ethereumPublicClient.estimateGas({
      account: activeWallet.address,

      to,

      value,

      data: "0x",
    });

    const maximumNetworkFeeWei = gas * fees.maxFeePerGas;

    const maximumTotalWei = value + maximumNetworkFeeWei;

    return {
      balanceWei,

      gas,

      maxFeePerGas: fees.maxFeePerGas,

      maxPriorityFeePerGas: fees.maxPriorityFeePerGas,

      maximumNetworkFeeWei,

      maximumTotalWei,

      hasSufficientBalance: maximumTotalWei <= balanceWei,
    };
  },
  async broadcastSignedTransaction(serializedTransaction: Hex): Promise<Hash> {
    const rpcChainId = await ethereumPublicClient.getChainId();

    if (rpcChainId !== ACTIVE_NETWORK.chain.id) {
      throw new Error(`RPC network does not match ${ACTIVE_NETWORK.name}`);
    }

    const expectedHash = keccak256(serializedTransaction);

    const hash = await ethereumPublicClient.sendRawTransaction({
      serializedTransaction,
    });

    if (hash.toLowerCase() !== expectedHash.toLowerCase()) {
      throw new Error("RPC returned unexpected transaction hash");
    }

    return hash;
  },

  async waitForTransactionReceipt(hash: Hash) {
    return ethereumPublicClient.waitForTransactionReceipt({
      hash,
      confirmations: 1,
      timeout: 60_000,
    });
  },

  async prepareNativeTransfer({ to, value }: PrepareNativeTransferInput) {
    const activeWallet = await walletEngine.getActive();

    if (!activeWallet) {
      throw new Error("Active wallet not found");
    }

    const intent: NativeTransferIntent = {
      kind: "native-transfer",

      chainId: ACTIVE_NETWORK.chain.id,

      from: activeWallet.address,

      to,

      value,
    };

    return prepareNativeTransfer(
      intent,
      {
        expectedChainId: ACTIVE_NETWORK.chain.id,

        expectedFrom: activeWallet.address,
      },
      ethereumPublicClient,
    );
  },

  async getErc20Balance(token: Address): Promise<bigint> {
    const activeWallet = await walletEngine.getActive();

    if (!activeWallet) {
      throw new Error("Active wallet not found");
    }

    return ethereumPublicClient.readContract({
      address: token,

      abi: erc20Abi,

      functionName: "balanceOf",

      args: [activeWallet.address],
    });
  },

  async quoteErc20Transfer({
    token,
    to,
    amount,
  }: Pick<Erc20TransferInput, "token" | "to" | "amount">): Promise<Erc20TransferQuote> {
    const activeWallet = await walletEngine.getActive();

    if (!activeWallet) {
      throw new Error("Active wallet not found");
    }

    const rpcChainId = await ethereumPublicClient.getChainId();

    if (rpcChainId !== ACTIVE_NETWORK.chain.id) {
      throw new Error(`RPC network does not match ${ACTIVE_NETWORK.name}`);
    }

    const [ethBalanceWei, tokenBalance, fees] = await Promise.all([
      ethereumPublicClient.getBalance({
        address: activeWallet.address,

        blockTag: "pending",
      }),

      ethereumPublicClient.readContract({
        address: token,

        abi: erc20Abi,

        functionName: "balanceOf",

        args: [activeWallet.address],
      }),

      ethereumPublicClient.estimateFeesPerGas(),
    ]);

    if (amount > tokenBalance) {
      return {
        ethBalanceWei,

        tokenBalance,

        gas: 0n,

        maxFeePerGas: fees.maxFeePerGas,

        maxPriorityFeePerGas: fees.maxPriorityFeePerGas,

        maximumNetworkFeeWei: 0n,

        hasSufficientTokenBalance: false,

        hasSufficientEthForFee: ethBalanceWei > 0n,
      };
    }

    const gas = await ethereumPublicClient.estimateGas({
      account: activeWallet.address,

      to: token,

      value: 0n,

      data: encodeErc20Transfer(to, amount),
    });

    const maximumNetworkFeeWei = gas * fees.maxFeePerGas;

    return {
      ethBalanceWei,

      tokenBalance,

      gas,

      maxFeePerGas: fees.maxFeePerGas,

      maxPriorityFeePerGas: fees.maxPriorityFeePerGas,

      maximumNetworkFeeWei,

      hasSufficientTokenBalance: true,

      hasSufficientEthForFee: maximumNetworkFeeWei <= ethBalanceWei,
    };
  },

  async getSwapAllowance(token: Address): Promise<bigint> {
    const activeWallet = await walletEngine.getActive();

    if (!activeWallet) {
      throw new Error("Active wallet not found");
    }

    const deployment = requireDeployment();

    return ethereumPublicClient.readContract({
      address: token,

      abi: erc20Abi,

      functionName: "allowance",

      args: [activeWallet.address, deployment.swapRouter02],
    });
  },

  async quoteSwap({
    assetIn,
    assetOut,
    amountIn,
  }: SwapQuoteInput): Promise<SwapQuote | null> {
    const activeWallet = await walletEngine.getActive();

    if (!activeWallet) {
      throw new Error("Active wallet not found");
    }

    const deployment = requireDeployment();

    const rpcChainId = await ethereumPublicClient.getChainId();

    if (rpcChainId !== ACTIVE_NETWORK.chain.id) {
      throw new Error(`RPC network does not match ${ACTIVE_NETWORK.name}`);
    }

    const routeTokenIn = resolveRouteAddress(assetIn, deployment);

    const routeTokenOut = resolveRouteAddress(assetOut, deployment);

    const nativeIn = assetIn.address === null;

    const [best, ethBalanceWei, tokenInBalance, allowance, fees] =
      await Promise.all([
        quoteBestSwapRoute(
          ethereumPublicClient,
          deployment,
          routeTokenIn,
          routeTokenOut,
          amountIn,
        ),

        ethereumPublicClient.getBalance({
          address: activeWallet.address,

          blockTag: "pending",
        }),

        nativeIn
          ? Promise.resolve(0n)
          : ethereumPublicClient.readContract({
              address: assetIn.address as Address,

              abi: erc20Abi,

              functionName: "balanceOf",

              args: [activeWallet.address],
            }),

        nativeIn
          ? Promise.resolve(0n)
          : ethereumPublicClient.readContract({
              address: assetIn.address as Address,

              abi: erc20Abi,

              functionName: "allowance",

              args: [activeWallet.address, deployment.swapRouter02],
            }),

        ethereumPublicClient.estimateFeesPerGas(),
      ]);

    if (!best) {
      return null;
    }

    const minAmountOut =
      (best.amountOut * BigInt(10_000 - SWAP_SLIPPAGE_BPS)) / 10_000n;

    const needsApproval = !nativeIn && allowance < amountIn;

    const hasSufficientBalance = nativeIn
      ? amountIn < ethBalanceWei
      : amountIn <= tokenInBalance;

    let gas = best.quoterGasEstimate + 80_000n;

    let gasIsExact = false;

    if (hasSufficientBalance && !needsApproval) {
      const deadline = BigInt(
        Math.floor(Date.now() / 1000) + SWAP_DEADLINE_SECONDS,
      );

      const { data, value } = encodeSwapCalldata({
        routeTokenIn,

        routeTokenOut,

        route: best.route,

        recipient: activeWallet.address,

        amountIn,

        minAmountOut,

        deadline,

        nativeIn,

        nativeOut: assetOut.address === null,

        weth9: deployment.weth9,
      });

      try {
        gas = await ethereumPublicClient.estimateGas({
          account: activeWallet.address,

          to: deployment.swapRouter02,

          value,

          data,
        });

        gasIsExact = true;
      } catch (estimateError) {
        console.error("Swap gas estimation failed:", estimateError);
      }
    }

    const maximumNetworkFeeWei = gas * fees.maxFeePerGas;

    const hasSufficientEthForFee = nativeIn
      ? amountIn + maximumNetworkFeeWei <= ethBalanceWei
      : maximumNetworkFeeWei <= ethBalanceWei;

    return {
      route: best.route,

      quotedAmountOut: best.amountOut,

      minAmountOut,

      ethBalanceWei,

      tokenInBalance,

      needsApproval,

      gas,

      gasIsExact,

      maxFeePerGas: fees.maxFeePerGas,

      maxPriorityFeePerGas: fees.maxPriorityFeePerGas,

      maximumNetworkFeeWei,

      hasSufficientBalance,

      hasSufficientEthForFee,
    };
  },

  async prepareSwap({
    assetIn,
    assetOut,
    amountIn,
    quotedAmountOut,
    route,
  }: SwapQuoteInput & {
    quotedAmountOut: bigint;

    route: SwapRoute;
  }) {
    const activeWallet = await walletEngine.getActive();

    if (!activeWallet) {
      throw new Error("Active wallet not found");
    }

    const deployment = requireDeployment();

    const minAmountOut =
      (quotedAmountOut * BigInt(10_000 - SWAP_SLIPPAGE_BPS)) / 10_000n;

    const intent: SwapIntent = {
      kind: "swap",

      chainId: ACTIVE_NETWORK.chain.id,

      from: activeWallet.address,

      assetIn,

      assetOut,

      amountIn,

      quotedAmountOut,

      minAmountOut,

      slippageBps: SWAP_SLIPPAGE_BPS,

      route,

      deadline: BigInt(Math.floor(Date.now() / 1000) + SWAP_DEADLINE_SECONDS),
    };

    return prepareSwap(
      intent,
      {
        now: Date.now(),

        expectedChainId: ACTIVE_NETWORK.chain.id,

        expectedFrom: activeWallet.address,

        deployment,
      },
      ethereumPublicClient,
    );
  },

  async getApprovals(assets: PortfolioAsset[]) {
    const activeWallet = await walletEngine.getActive();

    if (!activeWallet) {
      throw new Error("Active wallet not found");
    }

    return getApprovals(
      activeWallet.address,

      assets,

      ACTIVE_NETWORK.id,

      ethereumPublicClient,
    );
  },

  async prepareErc20Revoke({
    token,
    spender,
    tokenSymbol,
    spenderName,
  }: {
    token: Address;

    spender: Address;

    tokenSymbol: string;

    spenderName: string;
  }) {
    const activeWallet = await walletEngine.getActive();

    if (!activeWallet) {
      throw new Error("Active wallet not found");
    }

    return prepareErc20Revoke(
      {
        kind: "erc20-revoke",

        chainId: ACTIVE_NETWORK.chain.id,

        from: activeWallet.address,

        token,

        spender,

        tokenSymbol,

        spenderName,
      },
      {
        expectedChainId: ACTIVE_NETWORK.chain.id,

        expectedFrom: activeWallet.address,
      },
      ethereumPublicClient,
    );
  },

  async preparePermit2Revoke({
    token,
    spender,
    tokenSymbol,
    spenderName,
  }: {
    token: Address;

    spender: Address;

    tokenSymbol: string;

    spenderName: string;
  }) {
    const activeWallet = await walletEngine.getActive();

    if (!activeWallet) {
      throw new Error("Active wallet not found");
    }

    return preparePermit2Revoke(
      {
        kind: "permit2-revoke",

        chainId: ACTIVE_NETWORK.chain.id,

        from: activeWallet.address,

        token,

        spender,

        tokenSymbol,

        spenderName,
      },
      {
        expectedChainId: ACTIVE_NETWORK.chain.id,

        expectedFrom: activeWallet.address,
      },
      ethereumPublicClient,
    );
  },

  async prepareSwapApproval({
    token,
    amount,
    tokenSymbol,
    tokenDecimals,
  }: {
    token: Address;

    amount: bigint;

    tokenSymbol: string;

    tokenDecimals: number;
  }) {
    const activeWallet = await walletEngine.getActive();

    if (!activeWallet) {
      throw new Error("Active wallet not found");
    }

    const deployment = requireDeployment();

    const intent: Erc20ApproveIntent = {
      kind: "erc20-approve",

      chainId: ACTIVE_NETWORK.chain.id,

      from: activeWallet.address,

      token,

      spender: deployment.swapRouter02,

      amount,

      tokenSymbol,

      tokenDecimals,
    };

    return prepareErc20Approve(
      intent,
      {
        expectedChainId: ACTIVE_NETWORK.chain.id,

        expectedFrom: activeWallet.address,

        expectedSpender: deployment.swapRouter02,
      },
      ethereumPublicClient,
    );
  },

  async prepareErc20Transfer({
    token,
    to,
    amount,
    tokenSymbol,
    tokenDecimals,
  }: Erc20TransferInput) {
    const activeWallet = await walletEngine.getActive();

    if (!activeWallet) {
      throw new Error("Active wallet not found");
    }

    const intent: Erc20TransferIntent = {
      kind: "erc20-transfer",

      chainId: ACTIVE_NETWORK.chain.id,

      from: activeWallet.address,

      token,

      recipient: to,

      amount,

      tokenSymbol,

      tokenDecimals,
    };

    return prepareErc20Transfer(
      intent,
      {
        expectedChainId: ACTIVE_NETWORK.chain.id,

        expectedFrom: activeWallet.address,
      },
      ethereumPublicClient,
    );
  },
};
