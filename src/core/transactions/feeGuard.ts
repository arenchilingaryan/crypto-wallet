import { TransactionValidationError } from "./nativeTransfer";

const GWEI = 1_000_000_000n;

export const MAX_PRIORITY_FEE_PER_GAS_WEI = 100n * GWEI;

export const MAX_FEE_PER_GAS_WEI = 5_000n * GWEI;

// A single transaction can never use more gas than the block gas limit
// (~30M on Ethereum and Sepolia). A larger value is invalid on-chain and is
// only ever seen from a hostile RPC trying to inflate the fee or block sends.
export const MAX_GAS = 30_000_000n;

export function assertSaneFee({
  gas,
  maxFeePerGas,
  maxPriorityFeePerGas,
}: {
  gas: bigint;

  maxFeePerGas: bigint;

  maxPriorityFeePerGas: bigint;
}) {
  if (gas > MAX_GAS) {
    throw new TransactionValidationError(
      "INVALID_GAS",
      "The gas limit is above the block gas limit. This wallet refuses it so a bad network node cannot inflate the fee or block your transactions.",
    );
  }

  if (maxPriorityFeePerGas > MAX_PRIORITY_FEE_PER_GAS_WEI) {
    throw new TransactionValidationError(
      "INVALID_PRIORITY_FEE",
      "The priority fee is far above anything a normal transaction needs. This wallet refuses it so a bad network node cannot drain your balance as a tip.",
    );
  }

  if (maxFeePerGas > MAX_FEE_PER_GAS_WEI) {
    throw new TransactionValidationError(
      "INVALID_MAX_FEE",
      "The maximum network fee is far above any real gas price. This wallet refuses it so a bad network node cannot drain your balance as a fee.",
    );
  }
}
