import { signMessage } from "@/core/wallet/signMessage";

import { expoSecretStorage } from "./expoSecretStorage";

export const signerApi = {
  signMessage(walletId: string, message: string) {
    return signMessage(
      {
        walletId,
        message,
      },
      expoSecretStorage,
    );
  },
};
