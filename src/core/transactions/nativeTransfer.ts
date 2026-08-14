import { assertSaneFee } from "./feeGuard";
import { getAddress, isAddress, zeroAddress, type Address } from "viem";

export type NativeTransferIntent = {
  kind: "native-transfer";

  chainId: number;

  from: Address;
  to: Address;

  value: bigint;
};

export type PreparedNativeTransfer = {
  kind: "native-transfer";
  type: "eip1559";

  chainId: number;

  from: Address;
  to: Address;

  value: bigint;

  nonce: number;

  gas: bigint;

  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;

  data: "0x";
};

export type NativeTransferValidationContext = {
  expectedChainId: number;
  expectedFrom: Address;
};

export type PreparedNativeTransferValidationContext =
  NativeTransferValidationContext & {
    balanceWei: bigint;
  };

export type TransactionValidationErrorCode =
  | "INVALID_CHAIN"
  | "INVALID_FROM"
  | "INVALID_TO"
  | "ZERO_ADDRESS"
  | "INVALID_VALUE"
  | "INVALID_NONCE"
  | "INVALID_GAS"
  | "INVALID_MAX_FEE"
  | "INVALID_PRIORITY_FEE"
  | "INVALID_FEE_RELATION"
  | "INVALID_DATA"
  | "INSUFFICIENT_BALANCE";

export class TransactionValidationError extends Error {
  constructor(
    public readonly code: TransactionValidationErrorCode,
    message: string,
  ) {
    super(message);

    this.name = "TransactionValidationError";
  }
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
): Address {
  if (!isAddress(address)) {
    throw new TransactionValidationError(
      code,
      code === "INVALID_FROM"
        ? "Invalid sender address"
        : "Invalid recipient address",
    );
  }

  return getAddress(address);
}

function assertExpectedFrom(from: Address, expectedFrom: Address) {
  if (from.toLowerCase() !== expectedFrom.toLowerCase()) {
    throw new TransactionValidationError(
      "INVALID_FROM",
      "Transaction sender does not match active wallet",
    );
  }
}

function assertRecipient(to: Address) {
  if (to.toLowerCase() === zeroAddress.toLowerCase()) {
    throw new TransactionValidationError(
      "ZERO_ADDRESS",
      "Cannot send funds to the zero address",
    );
  }
}

function assertValue(value: bigint) {
  if (value <= 0n) {
    throw new TransactionValidationError(
      "INVALID_VALUE",
      "Transfer amount must be greater than zero",
    );
  }
}

export function validateNativeTransferIntent(
  intent: NativeTransferIntent,
  context: NativeTransferValidationContext,
): NativeTransferIntent {
  assertChain(intent.chainId, context.expectedChainId);

  const from = normalizeAddress(intent.from, "INVALID_FROM");

  const to = normalizeAddress(intent.to, "INVALID_TO");

  const expectedFrom = normalizeAddress(context.expectedFrom, "INVALID_FROM");

  assertExpectedFrom(from, expectedFrom);

  assertRecipient(to);

  assertValue(intent.value);

  return Object.freeze({
    kind: "native-transfer",
    chainId: intent.chainId,
    from,
    to,
    value: intent.value,
  });
}

export function validatePreparedNativeTransferForSigning(
  transaction: PreparedNativeTransfer,
  context: NativeTransferValidationContext,
): PreparedNativeTransfer {
  assertChain(transaction.chainId, context.expectedChainId);

  if (transaction.kind !== "native-transfer") {
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

  const from = normalizeAddress(transaction.from, "INVALID_FROM");

  const to = normalizeAddress(transaction.to, "INVALID_TO");

  const expectedFrom = normalizeAddress(context.expectedFrom, "INVALID_FROM");

  assertExpectedFrom(from, expectedFrom);

  assertRecipient(to);

  assertValue(transaction.value);

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

  if (transaction.data !== "0x") {
    throw new TransactionValidationError(
      "INVALID_DATA",
      "Native transfer cannot contain contract data",
    );
  }

  return Object.freeze({
    kind: "native-transfer",
    type: "eip1559",

    chainId: transaction.chainId,

    from,
    to,

    value: transaction.value,

    nonce: transaction.nonce,

    gas: transaction.gas,

    maxFeePerGas: transaction.maxFeePerGas,

    maxPriorityFeePerGas: transaction.maxPriorityFeePerGas,

    data: "0x",
  });
}

export function validatePreparedNativeTransfer(
  transaction: PreparedNativeTransfer,
  context: PreparedNativeTransferValidationContext,
): PreparedNativeTransfer {
  const validated = validatePreparedNativeTransferForSigning(
    transaction,
    context,
  );

  const maximumNetworkFee = validated.gas * validated.maxFeePerGas;

  const maximumTotalCost = validated.value + maximumNetworkFee;

  if (maximumTotalCost > context.balanceWei) {
    throw new TransactionValidationError(
      "INSUFFICIENT_BALANCE",
      "Insufficient balance for amount and maximum network fee",
    );
  }

  return validated;
}
