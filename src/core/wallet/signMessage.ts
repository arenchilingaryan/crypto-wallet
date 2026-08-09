import type { SecretStorage } from "./ports/secretStorage";

import { getWalletAccount } from "./getWalletAccount";

type SignMessageInput = {
  walletId: string;
  message: string;
};

export async function signMessage(
  { walletId, message }: SignMessageInput,
  storage: SecretStorage,
) {
  const account = await getWalletAccount(walletId, storage);

  return account.signMessage({
    message,
  });
}
