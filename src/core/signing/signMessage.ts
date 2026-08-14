import type { Address, Hex } from "viem";

import type { WalletSigner } from "@/core/ports/walletSigner";
import { assertSessionUnlocked } from "@/core/security/sessionLock";

import { signMessageAndVerify } from "./signAndVerify";

type SignMessageInput = {
  message: string;
};

export type SignedMessage = {
  address: Address;
  signature: Hex;
};

export async function signMessage(
  { message }: SignMessageInput,
  signer: WalletSigner,
): Promise<SignedMessage> {
  assertSessionUnlocked();

  if (!message.trim()) {
    throw new Error("Message cannot be empty");
  }

  const address = await signer.getAddress();

  const signature = await signMessageAndVerify(signer, message, address);

  return {
    address,
    signature,
  };
}
