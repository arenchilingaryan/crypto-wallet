import { ACTIVE_NETWORK } from "@/constants/networks";

import { signErc20Transfer } from "@/core/signing/signErc20Transfer";
import { signMessage } from "@/core/signing/signMessage";
import { signNativeTransfer } from "@/core/signing/signNativeTransfer";

import type { PreparedErc20Transfer } from "@/core/transactions/erc20Transfer";
import type { PreparedNativeTransfer } from "@/core/transactions/nativeTransfer";

import { expoSecretStorage } from "./expoSecretStorage";

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
};
