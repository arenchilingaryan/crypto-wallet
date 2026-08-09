import { signMessage } from "@/core/signing/signMessage";

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
};
