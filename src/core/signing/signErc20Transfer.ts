import type { Hex } from "viem";

import { assertSessionUnlocked } from "@/core/security/sessionLock";
import { consumeTransactionAuthorization } from "@/core/security/transactionAuthorization";

import {
    validatePreparedErc20TransferForSigning,
    type PreparedErc20Transfer,
} from "@/core/transactions/erc20Transfer";

import type { SecretStorage } from "@/core/wallet/ports/secretStorage";

import { getActiveSigningAccount } from "./getActiveSigningAccount";

type SignErc20TransferInput = {
  transaction: PreparedErc20Transfer;

  authorization: string;

  expectedChainId: number;
};

export async function signErc20Transfer(
  { transaction, authorization, expectedChainId }: SignErc20TransferInput,
  storage: SecretStorage,
): Promise<Hex> {
  assertSessionUnlocked();

  consumeTransactionAuthorization(transaction, authorization);

  const account = await getActiveSigningAccount(storage);

  const validated = validatePreparedErc20TransferForSigning(transaction, {
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
