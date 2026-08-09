import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";

const apiKey = process.env.EXPO_PUBLIC_ALCHEMY_API_KEY;

if (!apiKey) {
  throw new Error("EXPO_PUBLIC_ALCHEMY_API_KEY is missing");
}

export const ethereumPublicClient = createPublicClient({
  chain: sepolia,

  transport: http(`https://eth-sepolia.g.alchemy.com/v2/${apiKey}`),
});
