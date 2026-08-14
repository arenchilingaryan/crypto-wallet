import {
  parseTransaction,
  recoverMessageAddress,
  recoverTransactionAddress,
  serializeTransaction,
  type Address,
  type Hex,
} from "viem";

import type {
  SignableTransaction,
  WalletSigner,
} from "@/core/ports/walletSigner";

import { TransactionValidationError } from "@/core/transactions/nativeTransfer";

const SECP256K1_HALF_ORDER =
  0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0n;

export async function signAndVerify(
  signer: WalletSigner,
  payload: SignableTransaction,
): Promise<Hex> {
  const serialized = await signer.signTransaction(payload);

  let parsed: ReturnType<typeof parseTransaction>;

  try {
    parsed = parseTransaction(serialized);
  } catch {
    throw new TransactionValidationError(
      "INVALID_DATA",
      "Signed transaction is not decodable or not canonically encoded",
    );
  }

  const extras = parsed as {
    accessList?: unknown[];
    authorizationList?: unknown[];
    blobVersionedHashes?: unknown[];
  };

  if (extras.accessList && extras.accessList.length > 0) {
    throw new TransactionValidationError(
      "INVALID_DATA",
      "Signed transaction carries an access list the wallet did not approve",
    );
  }

  if (extras.authorizationList && extras.authorizationList.length > 0) {
    throw new TransactionValidationError(
      "INVALID_DATA",
      "Signed transaction carries an authorization list the wallet did not approve",
    );
  }

  if (extras.blobVersionedHashes && extras.blobVersionedHashes.length > 0) {
    throw new TransactionValidationError(
      "INVALID_DATA",
      "Signed transaction carries blobs the wallet did not approve",
    );
  }

  assertEqual("type", parsed.type, payload.type);

  assertEqual("chain", parsed.chainId, payload.chainId);

  assertEqual("recipient", parsed.to?.toLowerCase(), payload.to.toLowerCase());

  assertEqual("value", parsed.value ?? 0n, payload.value);

  assertEqual("nonce", parsed.nonce ?? 0, payload.nonce);

  assertEqual("gas limit", parsed.gas ?? 0n, payload.gas);

  assertEqual("maximum fee", parsed.maxFeePerGas ?? 0n, payload.maxFeePerGas);

  assertEqual(
    "priority fee",
    parsed.maxPriorityFeePerGas ?? 0n,
    payload.maxPriorityFeePerGas,
  );

  assertEqual(
    "data",
    (parsed.data ?? "0x").toLowerCase(),
    payload.data.toLowerCase(),
  );

  const { r, s, v, yParity, ...unsigned } = parsed as typeof parsed & {
    r?: Hex;
    s?: Hex;
    v?: bigint;
    yParity?: number;
  };

  const canonical = serializeTransaction(unsigned, {
    r: r as Hex,
    s: s as Hex,
    ...(yParity === undefined ? { v: v as bigint } : { yParity, v }),
  } as Parameters<typeof serializeTransaction>[1]);

  if (canonical.toLowerCase() !== serialized.toLowerCase()) {
    throw new TransactionValidationError(
      "INVALID_DATA",
      "Signed transaction is not canonically encoded",
    );
  }

  if (s !== undefined && BigInt(s) > SECP256K1_HALF_ORDER) {
    throw new TransactionValidationError(
      "INVALID_DATA",
      "Signed transaction uses a non-canonical (high-s) signature",
    );
  }

  const signerAddress = await recoverTransactionAddress({
    serializedTransaction: serialized as Parameters<
      typeof recoverTransactionAddress
    >[0]["serializedTransaction"],
  });

  if (signerAddress.toLowerCase() !== payload.from.toLowerCase()) {
    throw new TransactionValidationError(
      "INVALID_FROM",
      "Signed transaction belongs to a different address",
    );
  }

  return serialized;
}

export async function signMessageAndVerify(
  signer: WalletSigner,
  message: string,
  expectedAddress: Address,
): Promise<Hex> {
  const signature = await signer.signMessage(message);

  const signerAddress = await recoverMessageAddress({
    message,
    signature,
  });

  if (signerAddress.toLowerCase() !== expectedAddress.toLowerCase()) {
    throw new TransactionValidationError(
      "INVALID_FROM",
      "Signed message belongs to a different address",
    );
  }

  return signature;
}

function assertEqual(field: string, actual: unknown, expected: unknown) {
  if (actual !== expected) {
    throw new TransactionValidationError(
      "INVALID_DATA",
      `Signed transaction ${field} does not match the approved transaction`,
    );
  }
}
