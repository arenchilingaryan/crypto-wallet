import type { Chain } from "viem";
import { mainnet, sepolia } from "viem/chains";

export type AppNetwork = {
  id: "eth-mainnet" | "eth-sepolia";

  name: string;

  nativeSymbol: "ETH";

  chain: Chain;

  isTestnet: boolean;

  tokenSearchNetwork: string | null;
};

export const Networks = {
  ethereum: {
    id: "eth-mainnet",
    name: "Ethereum",
    nativeSymbol: "ETH",
    chain: mainnet,
    isTestnet: false,

    tokenSearchNetwork: "eth",
  },

  sepolia: {
    id: "eth-sepolia",
    name: "Ethereum Sepolia",
    nativeSymbol: "ETH",
    chain: sepolia,
    isTestnet: true,

    tokenSearchNetwork: null,
  },
} as const satisfies Record<string, AppNetwork>;

export const ACTIVE_NETWORK = Networks.sepolia;

export function isTestnetNetwork(networkId: string) {
  return Object.values(Networks).some(
    (network) => network.id === networkId && network.isTestnet,
  );
}
