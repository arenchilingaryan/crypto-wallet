import type { Address, Hex } from "viem";

import { assertSessionUnlocked } from "@/core/security/sessionLock";
import { consumeTransactionAuthorization } from "@/core/security/transactionAuthorization";

import {
  validatePreparedErc20ApproveForSigning,
  type PreparedErc20Approve,
} from "@/core/transactions/erc20Approve";

import type {
  SignableTransaction,
  WalletSigner,
} from "@/core/ports/walletSigner";

import { signAndVerify } from "./signAndVerify";

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
  signer: WalletSigner,
): Promise<Hex> {
  assertSessionUnlocked();

  consumeTransactionAuthorization(transaction, authorization);

  const address = await signer.getAddress();

  const validated = validatePreparedErc20ApproveForSigning(transaction, {
    expectedChainId,

    expectedFrom: address,

    expectedSpender,
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
