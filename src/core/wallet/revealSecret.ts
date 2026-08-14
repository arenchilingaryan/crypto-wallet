import { mnemonicToAccount } from "viem/accounts";

import type { Address } from "viem";

export type RevealedSecret = {
  address: Address;

  recoveryPhrase: string;

  privateKey: `0x${string}`;
};

function toHex(bytes: Uint8Array): `0x${string}` {
  return `0x${Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}`;
}

export function revealSecret(
  mnemonic: string,
  expectedAddress: Address,
): RevealedSecret {
  const account = mnemonicToAccount(mnemonic);

  if (account.address.toLowerCase() !== expectedAddress.toLowerCase()) {
    throw new Error(
      "The stored phrase does not belong to this wallet, so nothing is shown",
    );
  }

  const privateKey = account.getHdKey().privateKey;

  if (!privateKey || privateKey.length !== 32) {
    throw new Error("This wallet has no private key that can be shown");
  }

  return {
    address: account.address,

    recoveryPhrase: mnemonic,

    privateKey: toHex(privateKey),
  };
}
