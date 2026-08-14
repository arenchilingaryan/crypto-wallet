import type { PublicClient } from "viem";

import { PERMIT2_ADDRESS } from "@/core/blockchain/permit2";

import { TransactionValidationError } from "./nativeTransfer";
import {
  encodePermit2Revoke,
  validatePermit2RevokeIntent,
  validatePreparedPermit2Revoke,
  type Permit2RevokeIntent,
  type Permit2RevokeValidationContext,
  type PreparedPermit2Revoke,
} from "./permit2Revoke";

export async function preparePermit2Revoke(
  intent: Permit2RevokeIntent,
  context: Permit2RevokeValidationContext,
  client: PublicClient,
): Promise<PreparedPermit2Revoke> {
  const rpcChainId = await client.getChainId();

  if (rpcChainId !== context.expectedChainId) {
    throw new TransactionValidationError(
      "INVALID_CHAIN",
      "RPC network does not match expected network",
    );
  }

  const validatedIntent = validatePermit2RevokeIntent(intent, context);

  const data = encodePermit2Revoke(
    validatedIntent.token,
    validatedIntent.spender,
  );

  const [balanceWei, nonce, gas, fees] = await Promise.all([
    client.getBalance({
      address: validatedIntent.from,
      blockTag: "pending",
    }),

    client.getTransactionCount({
      address: validatedIntent.from,
      blockTag: "pending",
    }),

    client.estimateGas({
      account: validatedIntent.from,

      to: PERMIT2_ADDRESS,

      value: 0n,

      data,
    }),

    client.estimateFeesPerGas(),
  ]);

  const transaction: PreparedPermit2Revoke = {
    ...validatedIntent,

    type: "eip1559",

    to: PERMIT2_ADDRESS,

    value: 0n,

    nonce,

    gas,

    maxFeePerGas: fees.maxFeePerGas,

    maxPriorityFeePerGas: fees.maxPriorityFeePerGas,

    data,
  };

  return validatePreparedPermit2Revoke(transaction, {
    expectedChainId: context.expectedChainId,

    expectedFrom: context.expectedFrom,

    balanceWei,
  });
}
