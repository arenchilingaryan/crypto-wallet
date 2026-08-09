import type { PublicClient } from "viem";

import {
    TransactionValidationError,
    validateNativeTransferIntent,
    validatePreparedNativeTransfer,
    type NativeTransferIntent,
    type NativeTransferValidationContext,
    type PreparedNativeTransfer,
} from "./nativeTransfer";

export async function prepareNativeTransfer(
  intent: NativeTransferIntent,
  context: NativeTransferValidationContext,
  client: PublicClient,
): Promise<PreparedNativeTransfer> {
  const rpcChainId = await client.getChainId();

  if (rpcChainId !== context.expectedChainId) {
    throw new TransactionValidationError(
      "INVALID_CHAIN",
      "RPC network does not match expected network",
    );
  }

  const validatedIntent = validateNativeTransferIntent(intent, context);

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

      to: validatedIntent.to,

      value: validatedIntent.value,

      data: "0x",
    }),

    client.estimateFeesPerGas(),
  ]);

  const transaction: PreparedNativeTransfer = {
    kind: "native-transfer",
    type: "eip1559",

    chainId: validatedIntent.chainId,

    from: validatedIntent.from,

    to: validatedIntent.to,

    value: validatedIntent.value,

    nonce,

    gas,

    maxFeePerGas: fees.maxFeePerGas,

    maxPriorityFeePerGas: fees.maxPriorityFeePerGas,

    data: "0x",
  };

  return validatePreparedNativeTransfer(transaction, {
    expectedChainId: context.expectedChainId,

    expectedFrom: context.expectedFrom,

    balanceWei,
  });
}
