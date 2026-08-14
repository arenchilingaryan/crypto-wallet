import { ACTIVE_NETWORK } from "@/constants/networks";

import { getUniswapDeployment } from "@/core/blockchain/uniswap";
import { signErc20Approve } from "@/core/signing/signErc20Approve";
import { signErc20Revoke } from "@/core/signing/signErc20Revoke";
import { signPermit2Revoke } from "@/core/signing/signPermit2Revoke";
import { signErc20Transfer } from "@/core/signing/signErc20Transfer";
import { signMessage } from "@/core/signing/signMessage";
import { signNativeTransfer } from "@/core/signing/signNativeTransfer";
import { signSwap } from "@/core/signing/signSwap";

import type { PreparedErc20Approve } from "@/core/transactions/erc20Approve";
import type { PreparedErc20Revoke } from "@/core/transactions/erc20Revoke";
import type { PreparedPermit2Revoke } from "@/core/transactions/permit2Revoke";
import type { PreparedErc20Transfer } from "@/core/transactions/erc20Transfer";
import type { PreparedNativeTransfer } from "@/core/transactions/nativeTransfer";
import type { PreparedSwap } from "@/core/transactions/swap";

import { walletSigner } from "./compositionRoot";

function requireUniswapDeployment() {
  const deployment = getUniswapDeployment(ACTIVE_NETWORK.id);

  if (!deployment) {
    throw new Error(`Swaps are not supported on ${ACTIVE_NETWORK.name}`);
  }

  return deployment;
}

export const signerApi = {
  signMessage(message: string) {
    return signMessage(
      {
        message,
      },
      walletSigner,
    );
  },

  signNativeTransfer(
    transaction: PreparedNativeTransfer,

    authorization: string,
  ) {
    return signNativeTransfer(
      {
        transaction,
        authorization,
        expectedChainId: ACTIVE_NETWORK.chain.id,
      },

      walletSigner,
    );
  },

  signErc20Transfer(
    transaction: PreparedErc20Transfer,

    authorization: string,
  ) {
    return signErc20Transfer(
      {
        transaction,
        authorization,
        expectedChainId: ACTIVE_NETWORK.chain.id,
      },

      walletSigner,
    );
  },

  signErc20Approve(
    transaction: PreparedErc20Approve,

    authorization: string,
  ) {
    return signErc20Approve(
      {
        transaction,
        authorization,
        expectedChainId: ACTIVE_NETWORK.chain.id,
        expectedSpender: requireUniswapDeployment().swapRouter02,
      },

      walletSigner,
    );
  },

  signErc20Revoke(
    transaction: PreparedErc20Revoke,

    authorization: string,
  ) {
    return signErc20Revoke(
      {
        transaction,
        authorization,
        expectedChainId: ACTIVE_NETWORK.chain.id,
      },

      walletSigner,
    );
  },

  signPermit2Revoke(
    transaction: PreparedPermit2Revoke,

    authorization: string,
  ) {
    return signPermit2Revoke(
      {
        transaction,
        authorization,
        expectedChainId: ACTIVE_NETWORK.chain.id,
      },

      walletSigner,
    );
  },

  signSwap(
    transaction: PreparedSwap,

    authorization: string,
  ) {
    return signSwap(
      {
        transaction,
        authorization,
        now: Date.now(),
        expectedChainId: ACTIVE_NETWORK.chain.id,
        deployment: requireUniswapDeployment(),
      },

      walletSigner,
    );
  },
};
