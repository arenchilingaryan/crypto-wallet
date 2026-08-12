import type { Hex } from "viem";

import { assertSessionUnlocked } from "@/core/security/sessionLock";
import { consumeTransactionAuthorization } from "@/core/security/transactionAuthorization";

import {
  validatePreparedSwapForSigning,
  type PreparedSwap,
  type SwapValidationContext,
} from "@/core/transactions/swap";

import type { SecretStorage } from "@/core/wallet/ports/secretStorage";

import { getActiveSigningAccount } from "./getActiveSigningAccount";

type SignSwapInput = {
  transaction: PreparedSwap;

  authorization: string;

  expectedChainId: number;

  deployment: SwapValidationContext["deployment"];
};

export async function signSwap(
  { transaction, authorization, expectedChainId, deployment }: SignSwapInput,
  storage: SecretStorage,
): Promise<Hex> {
  assertSessionUnlocked();

  consumeTransactionAuthorization(transaction, authorization);

  const account = await getActiveSigningAccount(storage);

  const validated = validatePreparedSwapForSigning(transaction, {
    expectedChainId,

    expectedFrom: account.address,

    deployment,
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
