import { assertSaneFee } from "./feeGuard";
import {
  encodeFunctionData,
  getAddress,
  isAddress,
  zeroAddress,
  type Address,
  type Hex,
} from "viem";

import { PERMIT2_ADDRESS, permit2Abi } from "@/core/blockchain/permit2";

import { TransactionValidationError } from "./nativeTransfer";

export type Permit2RevokeIntent = {
  kind: "permit2-revoke";

  chainId: number;

  from: Address;

  token: Address;

  spender: Address;

  tokenSymbol: string;

  spenderName: string;
};

export type PreparedPermit2Revoke = Permit2RevokeIntent & {
  type: "eip1559";

  to: Address;

  value: bigint;

  nonce: number;

  gas: bigint;

  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;

  data: Hex;
};

export type Permit2RevokeValidationContext = {
  expectedChainId: number;

  expectedFrom: Address;
};

export type PreparedPermit2RevokeValidationContext =
  Permit2RevokeValidationContext & {
    balanceWei: bigint;
  };

export function encodePermit2Revoke(token: Address, spender: Address): Hex {
  return encodeFunctionData({
    abi: permit2Abi,

    functionName: "approve",

    args: [token, spender, 0n, 0],
  });
}

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

export function validatePermit2RevokeIntent(
  intent: Permit2RevokeIntent,
  context: Permit2RevokeValidationContext,
): Permit2RevokeIntent {
  if (intent.kind !== "permit2-revoke") {
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
    kind: "permit2-revoke",

    chainId: intent.chainId,

    from,

    token,

    spender,

    tokenSymbol: intent.tokenSymbol,

    spenderName: intent.spenderName,
  });
}

export function validatePreparedPermit2RevokeForSigning(
  transaction: PreparedPermit2Revoke,
  context: Permit2RevokeValidationContext,
): PreparedPermit2Revoke {
  if (transaction.type !== "eip1559") {
    throw new TransactionValidationError(
      "INVALID_DATA",
      "Unsupported transaction type",
    );
  }

  const validatedIntent = validatePermit2RevokeIntent(transaction, context);

  const to = normalizeAddress(
    transaction.to,
    "INVALID_TO",
    "Invalid transaction target",
  );

  if (to.toLowerCase() !== PERMIT2_ADDRESS.toLowerCase()) {
    throw new TransactionValidationError(
      "INVALID_TO",
      "Permit2 revoke must target the Permit2 contract",
    );
  }

  if (transaction.value !== 0n) {
    throw new TransactionValidationError(
      "INVALID_VALUE",
      "Revoke cannot carry ETH value",
    );
  }

  const expectedData = encodePermit2Revoke(
    validatedIntent.token,
    validatedIntent.spender,
  );

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

  assertSaneFee(transaction);

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

export function validatePreparedPermit2Revoke(
  transaction: PreparedPermit2Revoke,
  context: PreparedPermit2RevokeValidationContext,
): PreparedPermit2Revoke {
  const validated = validatePreparedPermit2RevokeForSigning(
    transaction,
    context,
  );

  if (validated.gas * validated.maxFeePerGas > context.balanceWei) {
    throw new TransactionValidationError(
      "INSUFFICIENT_BALANCE",
      "Insufficient ETH balance for the network fee",
    );
  }

  return validated;
}
