import { ACTIVE_NETWORK } from "@/constants/networks";

import { getUniswapDeployment } from "@/core/blockchain/uniswap";
import { signErc20Approve } from "@/core/signing/signErc20Approve";
import { signErc20Revoke } from "@/core/signing/signErc20Revoke";
import { signErc20Transfer } from "@/core/signing/signErc20Transfer";
import { signMessage } from "@/core/signing/signMessage";
import { signNativeTransfer } from "@/core/signing/signNativeTransfer";
import { signSwap } from "@/core/signing/signSwap";

import type { PreparedErc20Approve } from "@/core/transactions/erc20Approve";
import type { PreparedErc20Revoke } from "@/core/transactions/erc20Revoke";
import type { PreparedErc20Transfer } from "@/core/transactions/erc20Transfer";
import type { PreparedNativeTransfer } from "@/core/transactions/nativeTransfer";
import type { PreparedSwap } from "@/core/transactions/swap";

import { expoSecretStorage } from "./expoSecretStorage";

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
      expoSecretStorage,
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

      expoSecretStorage,
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

      expoSecretStorage,
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

      expoSecretStorage,
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

      expoSecretStorage,
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
        expectedChainId: ACTIVE_NETWORK.chain.id,
        deployment: requireUniswapDeployment(),
      },

      expoSecretStorage,
    );
  },
};
