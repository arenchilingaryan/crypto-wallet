import type { PublicClient } from "viem";

import { encodeErc20Approve } from "./erc20Approve";
import {
  validateErc20RevokeIntent,
  validatePreparedErc20Revoke,
  type Erc20RevokeIntent,
  type Erc20RevokeValidationContext,
  type PreparedErc20Revoke,
} from "./erc20Revoke";
import { TransactionValidationError } from "./nativeTransfer";

export async function prepareErc20Revoke(
  intent: Erc20RevokeIntent,
  context: Erc20RevokeValidationContext,
  client: PublicClient,
): Promise<PreparedErc20Revoke> {
  const rpcChainId = await client.getChainId();

  if (rpcChainId !== context.expectedChainId) {
    throw new TransactionValidationError(
      "INVALID_CHAIN",
      "RPC network does not match expected network",
    );
  }

  const validatedIntent = validateErc20RevokeIntent(intent, context);

  const data = encodeErc20Approve(validatedIntent.spender, 0n);

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

      to: validatedIntent.token,

      value: 0n,

      data,
    }),

    client.estimateFeesPerGas(),
  ]);

  const transaction: PreparedErc20Revoke = {
    ...validatedIntent,

    type: "eip1559",

    to: validatedIntent.token,

    value: 0n,

    nonce,

    gas,

    maxFeePerGas: fees.maxFeePerGas,

    maxPriorityFeePerGas: fees.maxPriorityFeePerGas,

    data,
  };

  return validatePreparedErc20Revoke(transaction, {
    expectedChainId: context.expectedChainId,

    expectedFrom: context.expectedFrom,

    balanceWei,
  });
}
