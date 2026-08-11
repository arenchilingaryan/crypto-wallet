import type { PublicClient } from "viem";

import { erc20Abi } from "@/core/blockchain/erc20Abi";

import {
  encodeErc20Transfer,
  validateErc20TransferIntent,
  validatePreparedErc20Transfer,
  type Erc20TransferIntent,
  type Erc20TransferValidationContext,
  type PreparedErc20Transfer,
} from "./erc20Transfer";
import { TransactionValidationError } from "./nativeTransfer";

export async function prepareErc20Transfer(
  intent: Erc20TransferIntent,
  context: Erc20TransferValidationContext,
  client: PublicClient,
): Promise<PreparedErc20Transfer> {
  const rpcChainId = await client.getChainId();

  if (rpcChainId !== context.expectedChainId) {
    throw new TransactionValidationError(
      "INVALID_CHAIN",
      "RPC network does not match expected network",
    );
  }

  const validatedIntent = validateErc20TransferIntent(intent, context);

  const data = encodeErc20Transfer(
    validatedIntent.recipient,
    validatedIntent.amount,
  );

  const [balanceWei, tokenBalance, nonce, gas, fees] = await Promise.all([
    client.getBalance({
      address: validatedIntent.from,
      blockTag: "pending",
    }),

    client.readContract({
      address: validatedIntent.token,

      abi: erc20Abi,

      functionName: "balanceOf",

      args: [validatedIntent.from],
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

  const transaction: PreparedErc20Transfer = {
    kind: "erc20-transfer",
    type: "eip1559",

    chainId: validatedIntent.chainId,

    from: validatedIntent.from,

    to: validatedIntent.token,

    value: 0n,

    token: validatedIntent.token,

    recipient: validatedIntent.recipient,

    amount: validatedIntent.amount,

    tokenSymbol: validatedIntent.tokenSymbol,

    tokenDecimals: validatedIntent.tokenDecimals,

    nonce,

    gas,

    maxFeePerGas: fees.maxFeePerGas,

    maxPriorityFeePerGas: fees.maxPriorityFeePerGas,

    data,
  };

  return validatePreparedErc20Transfer(transaction, {
    expectedChainId: context.expectedChainId,

    expectedFrom: context.expectedFrom,

    balanceWei,

    tokenBalance,
  });
}
