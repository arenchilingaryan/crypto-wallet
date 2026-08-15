import type { Address } from "viem";

// The wallet a decision was made about. Every step of a send — the security
// review, the prepared transaction, the signature — has to be about the same
// one. Each step independently asking "which wallet is active right now?" is
// how a review of wallet A ends up attached to a transaction from wallet B.
export type WalletIdentity = {
  id: string;

  address: Address;
};

export class WalletIdentityChangedError extends Error {
  constructor() {
    super(
      "The active wallet changed while this was being prepared, so the security review no longer describes the wallet it would be sent from. Start again.",
    );

    this.name = "WalletIdentityChangedError";
  }
}

export function sameWalletIdentity(
  expected: WalletIdentity | null | undefined,
  actual: WalletIdentity | null | undefined,
): boolean {
  if (!expected || !actual) {
    return false;
  }

  return (
    expected.id === actual.id &&
    expected.address.toLowerCase() === actual.address.toLowerCase()
  );
}

// A missing expectation is treated exactly like a mismatched one: an unbound
// preparation is the defect this guard exists to prevent.
export function assertSameWalletIdentity(
  expected: WalletIdentity | null | undefined,
  actual: WalletIdentity | null | undefined,
): void {
  if (!sameWalletIdentity(expected, actual)) {
    throw new WalletIdentityChangedError();
  }
}

export function walletIdentityOf(wallet: {
  id: string;

  address: Address;
}): WalletIdentity {
  return { id: wallet.id, address: wallet.address };
}
