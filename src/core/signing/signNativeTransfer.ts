import type { Hex } from "viem";

import { assertSessionUnlocked } from "@/core/security/sessionLock";
import { consumeTransactionAuthorization } from "@/core/security/transactionAuthorization";

import {
    type PreparedNativeTransfer,
    validatePreparedNativeTransferForSigning,
} from "@/core/transactions/nativeTransfer";

import type { SecretStorage } from "@/core/wallet/ports/secretStorage";

import { getActiveSigningAccount } from "./getActiveSigningAccount";

type SignNativeTransferInput = {
  transaction: PreparedNativeTransfer;

  authorization: string;

  expectedChainId: number;
};

export async function signNativeTransfer(
  { transaction, authorization, expectedChainId }: SignNativeTransferInput,
  storage: SecretStorage,
): Promise<Hex> {
  assertSessionUnlocked();

  consumeTransactionAuthorization(transaction, authorization);

  const account = await getActiveSigningAccount(storage);

  const validated = validatePreparedNativeTransferForSigning(transaction, {
    expectedChainId,

    expectedFrom: account.address,
  });

  const signedTransaction = await account.signTransaction({
    type: "eip1559",

    chainId: validated.chainId,

    to: validated.to,

    value: validated.value,

    nonce: validated.nonce,

    gas: validated.gas,

    maxFeePerGas: validated.maxFeePerGas,

    maxPriorityFeePerGas: validated.maxPriorityFeePerGas,

    data: validated.data,
  });

  return signedTransaction;
}
