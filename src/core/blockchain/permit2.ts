import { getAddress, type Address } from "viem";

export const PERMIT2_ADDRESS = getAddress(
  "0x000000000022D473030F116dDEE9F6B43aC78BA3",
);

export const permit2Abi = [
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "token", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [
      { name: "amount", type: "uint160" },
      { name: "expiration", type: "uint48" },
      { name: "nonce", type: "uint48" },
    ],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "spender", type: "address" },
      { name: "amount", type: "uint160" },
      { name: "expiration", type: "uint48" },
    ],
    outputs: [],
  },
] as const;

export const PERMIT2_UNLIMITED = 2n ** 160n - 1n;

export function getPermit2Spenders(networkId: string): Address[] {
  if (networkId !== "eth-mainnet") {
    return [];
  }

  return [
    getAddress("0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD"),
    getAddress("0x66a9893cC07D91D95644AEDD05D03f95e1dBA8Af"),
    getAddress("0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45"),
    getAddress("0x111111125421cA6dc452d289314280a0f8842A65"),
    getAddress("0xDef1C0ded9bec7F1a1670819833240f027b25EfF"),
  ];
}

export function isPermit2Expired(expiration: number, now = Date.now()) {
  return expiration * 1000 <= now;
}
