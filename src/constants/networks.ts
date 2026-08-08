export const Networks = {
  ethereum: {
    id: "eth-mainnet",
    name: "Ethereum",
    nativeSymbol: "ETH",
  },

  sepolia: {
    id: "eth-sepolia",
    name: "Ethereum Sepolia",
    nativeSymbol: "ETH",
  },
} as const;

export const DEFAULT_NETWORK = Networks.ethereum;
