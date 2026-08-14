import {
  encodeFunctionData,
  getAddress,
  isAddress,
  zeroAddress,
  type Address,
  type Hex,
} from "viem";

import { erc20Abi } from "@/core/blockchain/erc20Abi";

import { TransactionValidationError } from "./nativeTransfer";

export type Erc20ApproveIntent = {
  kind: "erc20-approve";

  chainId: number;

  from: Address;

  token: Address;

  spender: Address;

  amount: bigint;

  tokenSymbol: string;

  tokenDecimals: number;
};

export type PreparedErc20Approve = Erc20ApproveIntent & {
  type: "eip1559";

  to: Address;

  value: bigint;

  nonce: number;

  gas: bigint;

  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;

  data: Hex;
};

export type Erc20ApproveValidationContext = {
  expectedChainId: number;

  expectedFrom: Address;

  expectedSpender: Address;
};

export type PreparedErc20ApproveValidationContext =
  Erc20ApproveValidationContext & {
    balanceWei: bigint;
  };

export function encodeErc20Approve(spender: Address, amount: bigint): Hex {
  return encodeFunctionData({
    abi: erc20Abi,

    functionName: "approve",

    args: [spender, amount],
  });
}

function assertChain(chainId: number, expectedChainId: number) {
  if (
    !Number.isSafeInteger(chainId) ||
    chainId <= 0 ||
    chainId !== expectedChainId
  ) {
    throw new TransactionValidationError(
      "INVALID_CHAIN",
      "Transaction chain does not match active network",
    );
  }
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

export function validateErc20ApproveIntent(
  intent: Erc20ApproveIntent,
  context: Erc20ApproveValidationContext,
): Erc20ApproveIntent {
  assertChain(intent.chainId, context.expectedChainId);

  if (intent.kind !== "erc20-approve") {
    throw new TransactionValidationError(
      "INVALID_DATA",
      "Unsupported transaction kind",
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

  if (token.toLowerCase() === zeroAddress.toLowerCase()) {
    throw new TransactionValidationError(
      "ZERO_ADDRESS",
      "Invalid token contract address",
    );
  }

  const spender = normalizeAddress(
    intent.spender,
    "INVALID_TO",
    "Invalid spender address",
  );

  const expectedSpender = normalizeAddress(
    context.expectedSpender,
    "INVALID_TO",
    "Invalid spender address",
  );

  if (spender.toLowerCase() !== expectedSpender.toLowerCase()) {
    throw new TransactionValidationError(
      "INVALID_TO",
      "Approval spender must be the Uniswap router",
    );
  }

  if (intent.amount <= 0n) {
    throw new TransactionValidationError(
      "INVALID_VALUE",
      "Approval amount must be greater than zero",
    );
  }

  if (
    !Number.isSafeInteger(intent.tokenDecimals) ||
    intent.tokenDecimals < 0 ||
    intent.tokenDecimals > 77
  ) {
    throw new TransactionValidationError(
      "INVALID_DATA",
      "Invalid token decimals",
    );
  }

  return Object.freeze({
    kind: "erc20-approve",

    chainId: intent.chainId,

    from,

    token,

    spender,

    amount: intent.amount,

    tokenSymbol: intent.tokenSymbol,

    tokenDecimals: intent.tokenDecimals,
  });
}

export function validatePreparedErc20ApproveForSigning(
  transaction: PreparedErc20Approve,
  context: Erc20ApproveValidationContext,
): PreparedErc20Approve {
  if (transaction.type !== "eip1559") {
    throw new TransactionValidationError(
      "INVALID_DATA",
      "Unsupported transaction type",
    );
  }

  const validatedIntent = validateErc20ApproveIntent(transaction, context);

  const to = normalizeAddress(
    transaction.to,
    "INVALID_TO",
    "Invalid transaction target",
  );

  if (to.toLowerCase() !== validatedIntent.token.toLowerCase()) {
    throw new TransactionValidationError(
      "INVALID_TO",
      "Approval must target the token contract",
    );
  }

  if (transaction.value !== 0n) {
    throw new TransactionValidationError(
      "INVALID_VALUE",
      "Approval cannot carry ETH value",
    );
  }

  const expectedData = encodeErc20Approve(
    validatedIntent.spender,
    validatedIntent.amount,
  );

  if (transaction.data.toLowerCase() !== expectedData.toLowerCase()) {
    throw new TransactionValidationError(
      "INVALID_DATA",
      "Transaction data does not match the approval intent",
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

export function validatePreparedErc20Approve(
  transaction: PreparedErc20Approve,
  context: PreparedErc20ApproveValidationContext,
): PreparedErc20Approve {
  const validated = validatePreparedErc20ApproveForSigning(
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
