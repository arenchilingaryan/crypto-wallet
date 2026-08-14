import type { Hex } from "viem";

import type {
  SignableTransaction,
  WalletSigner,
} from "@/core/ports/walletSigner";

import { assertSessionUnlocked } from "@/core/security/sessionLock";
import { consumeTransactionAuthorization } from "@/core/security/transactionAuthorization";

import {
  validatePreparedPermit2RevokeForSigning,
  type PreparedPermit2Revoke,
} from "@/core/transactions/permit2Revoke";

import { signAndVerify } from "./signAndVerify";

type SignPermit2RevokeInput = {
  transaction: PreparedPermit2Revoke;

  authorization: string;

  expectedChainId: number;
};

export async function signPermit2Revoke(
  { transaction, authorization, expectedChainId }: SignPermit2RevokeInput,
  signer: WalletSigner,
): Promise<Hex> {
  assertSessionUnlocked();

  consumeTransactionAuthorization(transaction, authorization);

  const address = await signer.getAddress();

  const validated = validatePreparedPermit2RevokeForSigning(transaction, {
    expectedChainId,

    expectedFrom: address,
  });

  const payload: SignableTransaction = {
    type: "eip1559",

    chainId: validated.chainId,

    from: validated.from,

    to: validated.to,

    value: validated.value,

    nonce: validated.nonce,

    gas: validated.gas,

    maxFeePerGas: validated.maxFeePerGas,

    maxPriorityFeePerGas: validated.maxPriorityFeePerGas,

    data: validated.data,
  };

  return signAndVerify(signer, payload);
}
