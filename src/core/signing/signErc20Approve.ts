import type { Address, Hex } from "viem";

import { assertSessionUnlocked } from "@/core/security/sessionLock";
import { consumeTransactionAuthorization } from "@/core/security/transactionAuthorization";

import {
  validatePreparedErc20ApproveForSigning,
  type PreparedErc20Approve,
} from "@/core/transactions/erc20Approve";

import type { SecretStorage } from "@/core/wallet/ports/secretStorage";

import { getActiveSigningAccount } from "./getActiveSigningAccount";

type SignErc20ApproveInput = {
  transaction: PreparedErc20Approve;

  authorization: string;

  expectedChainId: number;

  expectedSpender: Address;
};

export async function signErc20Approve(
  {
    transaction,
    authorization,
    expectedChainId,
    expectedSpender,
  }: SignErc20ApproveInput,
  storage: SecretStorage,
): Promise<Hex> {
  assertSessionUnlocked();

  consumeTransactionAuthorization(transaction, authorization);

  const account = await getActiveSigningAccount(storage);

  const validated = validatePreparedErc20ApproveForSigning(transaction, {
    expectedChainId,

    expectedFrom: account.address,

    expectedSpender,
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
