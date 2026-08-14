import { assertSaneFee } from "./feeGuard";
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

export type Erc20TransferIntent = {
  kind: "erc20-transfer";

  chainId: number;

  from: Address;

  token: Address;

  recipient: Address;

  amount: bigint;

  tokenSymbol: string;

  tokenDecimals: number;
};

export type PreparedErc20Transfer = {
  kind: "erc20-transfer";
  type: "eip1559";

  chainId: number;

  from: Address;

  to: Address;

  value: bigint;

  token: Address;

  recipient: Address;

  amount: bigint;

  tokenSymbol: string;

  tokenDecimals: number;

  nonce: number;

  gas: bigint;

  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;

  data: Hex;
};

export type Erc20TransferValidationContext = {
  expectedChainId: number;
  expectedFrom: Address;
};

export type PreparedErc20TransferValidationContext =
  Erc20TransferValidationContext & {
    balanceWei: bigint;

    tokenBalance: bigint;
  };

export function encodeErc20Transfer(
  recipient: Address,
  amount: bigint,
): Hex {
  return encodeFunctionData({
    abi: erc20Abi,

    functionName: "transfer",

    args: [recipient, amount],
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

function assertNotZeroAddress(address: Address, message: string) {
  if (address.toLowerCase() === zeroAddress.toLowerCase()) {
    throw new TransactionValidationError("ZERO_ADDRESS", message);
  }
}

function assertAmount(amount: bigint) {
  if (amount <= 0n) {
    throw new TransactionValidationError(
      "INVALID_VALUE",
      "Transfer amount must be greater than zero",
    );
  }
}

function assertTokenDecimals(decimals: number) {
  if (!Number.isSafeInteger(decimals) || decimals < 0 || decimals > 77) {
    throw new TransactionValidationError(
      "INVALID_DATA",
      "Invalid token decimals",
    );
  }
}

export function validateErc20TransferIntent(
  intent: Erc20TransferIntent,
  context: Erc20TransferValidationContext,
): Erc20TransferIntent {
  assertChain(intent.chainId, context.expectedChainId);

  const from = normalizeAddress(
    intent.from,
    "INVALID_FROM",
    "Invalid sender address",
  );

  const token = normalizeAddress(
    intent.token,
    "INVALID_TO",
    "Invalid token contract address",
  );

  const recipient = normalizeAddress(
    intent.recipient,
    "INVALID_TO",
    "Invalid recipient address",
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

  assertNotZeroAddress(token, "Invalid token contract address");

  assertNotZeroAddress(recipient, "Cannot send tokens to the zero address");

  if (recipient.toLowerCase() === token.toLowerCase()) {
    throw new TransactionValidationError(
      "INVALID_TO",
      "Cannot send tokens to the token contract itself",
    );
  }

  assertAmount(intent.amount);

  assertTokenDecimals(intent.tokenDecimals);

  return Object.freeze({
    kind: "erc20-transfer",

    chainId: intent.chainId,

    from,

    token,

    recipient,

    amount: intent.amount,

    tokenSymbol: intent.tokenSymbol,

    tokenDecimals: intent.tokenDecimals,
  });
}

export function validatePreparedErc20TransferForSigning(
  transaction: PreparedErc20Transfer,
  context: Erc20TransferValidationContext,
): PreparedErc20Transfer {
  assertChain(transaction.chainId, context.expectedChainId);

  if (transaction.kind !== "erc20-transfer") {
    throw new TransactionValidationError(
      "INVALID_DATA",
      "Unsupported transaction kind",
    );
  }

  if (transaction.type !== "eip1559") {
    throw new TransactionValidationError(
      "INVALID_DATA",
      "Unsupported transaction type",
    );
  }

  const validatedIntent = validateErc20TransferIntent(
    {
      kind: "erc20-transfer",

      chainId: transaction.chainId,

      from: transaction.from,

      token: transaction.token,

      recipient: transaction.recipient,

      amount: transaction.amount,

      tokenSymbol: transaction.tokenSymbol,

      tokenDecimals: transaction.tokenDecimals,
    },
    context,
  );

  const to = normalizeAddress(
    transaction.to,
    "INVALID_TO",
    "Invalid transaction target",
  );

  if (to.toLowerCase() !== validatedIntent.token.toLowerCase()) {
    throw new TransactionValidationError(
      "INVALID_TO",
      "ERC-20 transfer must target the token contract",
    );
  }

  if (transaction.value !== 0n) {
    throw new TransactionValidationError(
      "INVALID_VALUE",
      "ERC-20 transfer cannot carry ETH value",
    );
  }

  const expectedData = encodeErc20Transfer(
    validatedIntent.recipient,
    validatedIntent.amount,
  );

  if (transaction.data.toLowerCase() !== expectedData.toLowerCase()) {
    throw new TransactionValidationError(
      "INVALID_DATA",
      "Transaction data does not match the transfer intent",
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
    kind: "erc20-transfer",
    type: "eip1559",

    chainId: transaction.chainId,

    from: validatedIntent.from,

    to,

    value: 0n,

    token: validatedIntent.token,

    recipient: validatedIntent.recipient,

    amount: validatedIntent.amount,

    tokenSymbol: validatedIntent.tokenSymbol,

    tokenDecimals: validatedIntent.tokenDecimals,

    nonce: transaction.nonce,

    gas: transaction.gas,

    maxFeePerGas: transaction.maxFeePerGas,

    maxPriorityFeePerGas: transaction.maxPriorityFeePerGas,

    data: expectedData,
  });
}

export function validatePreparedErc20Transfer(
  transaction: PreparedErc20Transfer,
  context: PreparedErc20TransferValidationContext,
): PreparedErc20Transfer {
  const validated = validatePreparedErc20TransferForSigning(
    transaction,
    context,
  );

  if (validated.amount > context.tokenBalance) {
    throw new TransactionValidationError(
      "INSUFFICIENT_BALANCE",
      "Insufficient token balance",
    );
  }

  const maximumNetworkFee = validated.gas * validated.maxFeePerGas;

  if (maximumNetworkFee > context.balanceWei) {
    throw new TransactionValidationError(
      "INSUFFICIENT_BALANCE",
      "Insufficient ETH balance for the network fee",
    );
  }

  return validated;
}
