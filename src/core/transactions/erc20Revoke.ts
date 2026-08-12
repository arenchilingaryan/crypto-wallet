import { getAddress, isAddress, zeroAddress, type Address, type Hex } from "viem";

import { encodeErc20Approve } from "./erc20Approve";
import { TransactionValidationError } from "./nativeTransfer";

/**
 * Отзыв разрешения: approve(spender, 0).
 *
 * Отдельный вид транзакции, а не «approve с нулём»: у approve спендер
 * жёстко пришит к роутеру Uniswap и сумма обязана быть больше нуля.
 * Ослаблять тот гард нельзя — он защищает своп. Здесь наоборот: спендер
 * любой, а сумма обязана быть ровно нулевой.
 */
export type Erc20RevokeIntent = {
  kind: "erc20-revoke";

  chainId: number;

  from: Address;

  token: Address;

  spender: Address;

  tokenSymbol: string;

  spenderName: string;
};

export type PreparedErc20Revoke = Erc20RevokeIntent & {
  type: "eip1559";

  to: Address;

  value: bigint;

  nonce: number;

  gas: bigint;

  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;

  data: Hex;
};

export type Erc20RevokeValidationContext = {
  expectedChainId: number;

  expectedFrom: Address;
};

export type PreparedErc20RevokeValidationContext =
  Erc20RevokeValidationContext & {
    balanceWei: bigint;
  };

function normalizeAddress(
  address: string,
  code: "INVALID_FROM" | "INVALID_TO",
  message: string,
): Address {
  if (!isAddress(address)) {
    throw new TransactionValidationError(code, message);
  }

  return getAddress(address);
}

export function validateErc20RevokeIntent(
  intent: Erc20RevokeIntent,
  context: Erc20RevokeValidationContext,
): Erc20RevokeIntent {
  if (intent.kind !== "erc20-revoke") {
    throw new TransactionValidationError(
      "INVALID_DATA",
      "Unsupported transaction kind",
    );
  }

  if (
    !Number.isSafeInteger(intent.chainId) ||
    intent.chainId !== context.expectedChainId
  ) {
    throw new TransactionValidationError(
      "INVALID_CHAIN",
      "Transaction chain does not match active network",
    );
  }

  const from = normalizeAddress(
    intent.from,
    "INVALID_FROM",
    "Invalid sender address",
  );

  const expectedFrom = normalizeAddress(
    context.expectedFrom,
    "INVALID_FROM",
    "Invalid sender address",
  );

  if (from.toLowerCase() !== expectedFrom.toLowerCase()) {
    throw new TransactionValidationError(
      "INVALID_FROM",
      "Transaction sender does not match active wallet",
    );
  }

  const token = normalizeAddress(
    intent.token,
    "INVALID_TO",
    "Invalid token contract address",
  );

  const spender = normalizeAddress(
    intent.spender,
    "INVALID_TO",
    "Invalid spender address",
  );

  if (
    token.toLowerCase() === zeroAddress.toLowerCase() ||
    spender.toLowerCase() === zeroAddress.toLowerCase()
  ) {
    throw new TransactionValidationError(
      "ZERO_ADDRESS",
      "Invalid revoke target",
    );
  }

  return Object.freeze({
    kind: "erc20-revoke",

    chainId: intent.chainId,

    from,

    token,

    spender,

    tokenSymbol: intent.tokenSymbol,

    spenderName: intent.spenderName,
  });
}

export function validatePreparedErc20RevokeForSigning(
  transaction: PreparedErc20Revoke,
  context: Erc20RevokeValidationContext,
): PreparedErc20Revoke {
  if (transaction.type !== "eip1559") {
    throw new TransactionValidationError(
      "INVALID_DATA",
      "Unsupported transaction type",
    );
  }

  const validatedIntent = validateErc20RevokeIntent(transaction, context);

  const to = normalizeAddress(
    transaction.to,
    "INVALID_TO",
    "Invalid transaction target",
  );

  if (to.toLowerCase() !== validatedIntent.token.toLowerCase()) {
    throw new TransactionValidationError(
      "INVALID_TO",
      "Revoke must target the token contract",
    );
  }

  if (transaction.value !== 0n) {
    throw new TransactionValidationError(
      "INVALID_VALUE",
      "Revoke cannot carry ETH value",
    );
  }

  // Integrity: calldata обязана быть ровно approve(spender, 0) —
  // подменить спендера или вернуть ненулевую сумму после подготовки нельзя.
  const expectedData = encodeErc20Approve(validatedIntent.spender, 0n);

  if (transaction.data.toLowerCase() !== expectedData.toLowerCase()) {
    throw new TransactionValidationError(
      "INVALID_DATA",
      "Transaction data does not match the revoke intent",
    );
  }

  if (!Number.isSafeInteger(transaction.nonce) || transaction.nonce < 0) {
    throw new TransactionValidationError(
      "INVALID_NONCE",
      "Invalid transaction nonce",
    );
  }

  if (transaction.gas <= 0n) {
    throw new TransactionValidationError("INVALID_GAS", "Invalid gas limit");
  }

  if (transaction.maxFeePerGas <= 0n) {
    throw new TransactionValidationError(
      "INVALID_MAX_FEE",
      "Invalid maximum network fee",
    );
  }

  if (transaction.maxPriorityFeePerGas < 0n) {
    throw new TransactionValidationError(
      "INVALID_PRIORITY_FEE",
      "Invalid priority fee",
    );
  }

  if (transaction.maxPriorityFeePerGas > transaction.maxFeePerGas) {
    throw new TransactionValidationError(
      "INVALID_FEE_RELATION",
      "Priority fee cannot exceed maximum fee",
    );
  }

  return Object.freeze({
    ...validatedIntent,

    type: "eip1559",

    to,

    value: 0n,

    nonce: transaction.nonce,

    gas: transaction.gas,

    maxFeePerGas: transaction.maxFeePerGas,

    maxPriorityFeePerGas: transaction.maxPriorityFeePerGas,

    data: expectedData,
  });
}

export function validatePreparedErc20Revoke(
  transaction: PreparedErc20Revoke,
  context: PreparedErc20RevokeValidationContext,
): PreparedErc20Revoke {
  const validated = validatePreparedErc20RevokeForSigning(
    transaction,
    context,
  );

  const maximumNetworkFee = validated.gas * validated.maxFeePerGas;

  if (maximumNetworkFee > context.balanceWei) {
    throw new TransactionValidationError(
      "INSUFFICIENT_BALANCE",
      "Insufficient ETH balance for the network fee",
    );
  }

  return validated;
}
