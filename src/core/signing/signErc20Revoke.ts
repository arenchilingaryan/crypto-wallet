import type { Hex } from "viem";

import { assertSessionUnlocked } from "@/core/security/sessionLock";
import { consumeTransactionAuthorization } from "@/core/security/transactionAuthorization";

import {
  validatePreparedErc20RevokeForSigning,
  type PreparedErc20Revoke,
} from "@/core/transactions/erc20Revoke";

import type { SecretStorage } from "@/core/wallet/ports/secretStorage";

import { getActiveSigningAccount } from "./getActiveSigningAccount";

type SignErc20RevokeInput = {
  transaction: PreparedErc20Revoke;

  authorization: string;

  expectedChainId: number;
};

export async function signErc20Revoke(
  { transaction, authorization, expectedChainId }: SignErc20RevokeInput,
  storage: SecretStorage,
): Promise<Hex> {
  assertSessionUnlocked();

  consumeTransactionAuthorization(transaction, authorization);

  const account = await getActiveSigningAccount(storage);

  const validated = validatePreparedErc20RevokeForSigning(transaction, {
    expectedChainId,

    expectedFrom: account.address,
  });

  return account.signTransaction({
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
}
