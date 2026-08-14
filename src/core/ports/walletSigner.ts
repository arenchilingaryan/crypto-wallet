import type { Address, Hex } from "viem";

export interface WalletSigner {
  getAddress(): Promise<Address>;

  signMessage(message: string): Promise<Hex>;

  signTransaction(transaction: SignableTransaction): Promise<Hex>;
}

export type SignableTransaction = {
  type: "eip1559";

  chainId: number;

  from: Address;

  to: Address;

  value: bigint;

  nonce: number;

  gas: bigint;

  maxFeePerGas: bigint;

  maxPriorityFeePerGas: bigint;

  data: Hex;
};
