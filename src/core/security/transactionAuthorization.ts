import type { PreparedErc20Approve } from "@/core/transactions/erc20Approve";
import type { PreparedErc20Revoke } from "@/core/transactions/erc20Revoke";
import type { PreparedErc20Transfer } from "@/core/transactions/erc20Transfer";
import type { PreparedNativeTransfer } from "@/core/transactions/nativeTransfer";
import type { PreparedSwap } from "@/core/transactions/swap";

// Все виды транзакций авторизуются одинаково: fingerprint строится из общих
// полей, а специфика (получатель, суммы, маршрут свопа) зашита в data.
export type AuthorizableTransaction =
  | PreparedNativeTransfer
  | PreparedErc20Transfer
  | PreparedErc20Approve
  | PreparedErc20Revoke
  | PreparedSwap;

const AUTHORIZATION_TTL_MS = 30_000;

type ActiveAuthorization = {
  token: string;
  fingerprint: string;
  expiresAt: number;
};

let activeAuthorization: ActiveAuthorization | null = null;

function fingerprintTransaction(transaction: AuthorizableTransaction) {
  return [
    transaction.kind,
    transaction.type,

    transaction.chainId,

    transaction.from.toLowerCase(),
    transaction.to.toLowerCase(),

    transaction.value.toString(),
    transaction.nonce.toString(),
    transaction.gas.toString(),

    transaction.maxFeePerGas.toString(),
    transaction.maxPriorityFeePerGas.toString(),

    transaction.data,
  ].join("|");
}

export function grantTransactionAuthorization(
  transaction: AuthorizableTransaction,
  token: string,
) {
  activeAuthorization = {
    token,

    fingerprint: fingerprintTransaction(transaction),

    expiresAt: Date.now() + AUTHORIZATION_TTL_MS,
  };
}

export function consumeTransactionAuthorization(
  transaction: AuthorizableTransaction,
  token: string,
) {
  const authorization = activeAuthorization;

  // Разрешение одноразовое даже при ошибке ниже.
  activeAuthorization = null;

  if (!authorization) {
    throw new Error("Transaction authorization is missing");
  }

  if (authorization.expiresAt < Date.now()) {
    throw new Error("Transaction authorization expired");
  }

  if (authorization.token !== token) {
    throw new Error("Invalid transaction authorization");
  }

  const fingerprint = fingerprintTransaction(transaction);

  if (fingerprint !== authorization.fingerprint) {
    throw new Error("Transaction changed after authorization");
  }
}

export function clearTransactionAuthorization() {
  activeAuthorization = null;
}
