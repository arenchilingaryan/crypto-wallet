import { ACTIVE_NETWORK } from "@/constants/networks";

import { signMessage } from "@/core/signing/signMessage";
import { signNativeTransfer } from "@/core/signing/signNativeTransfer";

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
};
