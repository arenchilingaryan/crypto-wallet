import type { Address, Hex } from "viem";

import type { SecretStorage } from "@/core/wallet/ports/secretStorage";

import { getActiveSigningAccount } from "./getActiveSigningAccount";

type SignMessageInput = {
  message: string;
};

export type SignedMessage = {
  address: Address;
  signature: Hex;
};

export async function signMessage(
  { message }: SignMessageInput,
  storage: SecretStorage,
): Promise<SignedMessage> {
  if (!message.trim()) {
    throw new Error("Message cannot be empty");
  }

  const account = await getActiveSigningAccount(storage);

  const signature = await account.signMessage({
    message,
  });

  return {
    address: account.address,
    signature,
  };
}
