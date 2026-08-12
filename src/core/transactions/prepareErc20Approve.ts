import type { PublicClient } from "viem";

import { TransactionValidationError } from "./nativeTransfer";
import {
  encodeErc20Approve,
  validateErc20ApproveIntent,
  validatePreparedErc20Approve,
  type Erc20ApproveIntent,
  type Erc20ApproveValidationContext,
  type PreparedErc20Approve,
} from "./erc20Approve";

export async function prepareErc20Approve(
  intent: Erc20ApproveIntent,
  context: Erc20ApproveValidationContext,
  client: PublicClient,
): Promise<PreparedErc20Approve> {
  const rpcChainId = await client.getChainId();

  if (rpcChainId !== context.expectedChainId) {
    throw new TransactionValidationError(
      "INVALID_CHAIN",
      "RPC network does not match expected network",
    );
  }

  const validatedIntent = validateErc20ApproveIntent(intent, context);

  const data = encodeErc20Approve(
    validatedIntent.spender,
    validatedIntent.amount,
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

      to: validatedIntent.token,

      value: 0n,

      data,
    }),

    client.estimateFeesPerGas(),
  ]);

  const transaction: PreparedErc20Approve = {
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

  return validatePreparedErc20Approve(transaction, {
    ...context,

    balanceWei,
  });
}
