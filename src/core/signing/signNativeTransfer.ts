import type { Hex } from "viem";

import { assertSessionUnlocked } from "@/core/security/sessionLock";
import { consumeTransactionAuthorization } from "@/core/security/transactionAuthorization";

import {
    type PreparedNativeTransfer,
    validatePreparedNativeTransferForSigning,
} from "@/core/transactions/nativeTransfer";

import type {
  SignableTransaction,
  WalletSigner,
} from "@/core/ports/walletSigner";

import { signAndVerify } from "./signAndVerify";

type SignNativeTransferInput = {
  transaction: PreparedNativeTransfer;

  authorization: string;

  expectedChainId: number;
};

export async function signNativeTransfer(
  { transaction, authorization, expectedChainId }: SignNativeTransferInput,
  signer: WalletSigner,
): Promise<Hex> {
  assertSessionUnlocked();

  consumeTransactionAuthorization(transaction, authorization);

  const address = await signer.getAddress();

  const validated = validatePreparedNativeTransferForSigning(transaction, {
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
