import type { Hex } from "viem";

import { assertSessionUnlocked } from "@/core/security/sessionLock";
import { consumeTransactionAuthorization } from "@/core/security/transactionAuthorization";

import {
    validatePreparedErc20TransferForSigning,
    type PreparedErc20Transfer,
} from "@/core/transactions/erc20Transfer";

import type {
  SignableTransaction,
  WalletSigner,
} from "@/core/ports/walletSigner";

import { signAndVerify } from "./signAndVerify";

type SignErc20TransferInput = {
  transaction: PreparedErc20Transfer;

  authorization: string;

  expectedChainId: number;
};

export async function signErc20Transfer(
  { transaction, authorization, expectedChainId }: SignErc20TransferInput,
  signer: WalletSigner,
): Promise<Hex> {
  assertSessionUnlocked();

  consumeTransactionAuthorization(transaction, authorization);

  const address = await signer.getAddress();

  const validated = validatePreparedErc20TransferForSigning(transaction, {
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
