import type { Hex } from "viem";

import { assertSessionUnlocked } from "@/core/security/sessionLock";
import { consumeTransactionAuthorization } from "@/core/security/transactionAuthorization";

import {
  validatePreparedSwapForSigning,
  type PreparedSwap,
  type SwapValidationContext,
} from "@/core/transactions/swap";

import type {
  SignableTransaction,
  WalletSigner,
} from "@/core/ports/walletSigner";

import { signAndVerify } from "./signAndVerify";

type SignSwapInput = {
  transaction: PreparedSwap;

  authorization: string;

  expectedChainId: number;

  now: number;

  deployment: SwapValidationContext["deployment"];
};

export async function signSwap(
  {
    transaction,
    authorization,
    expectedChainId,
    deployment,
    now,
  }: SignSwapInput,
  signer: WalletSigner,
): Promise<Hex> {
  assertSessionUnlocked();

  consumeTransactionAuthorization(transaction, authorization);

  const address = await signer.getAddress();

  const validated = validatePreparedSwapForSigning(transaction, {
    now,

    expectedChainId,

    expectedFrom: address,

    deployment,
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
