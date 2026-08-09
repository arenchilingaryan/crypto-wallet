import { createPublicClient, http } from "viem";

import { ACTIVE_NETWORK } from "@/constants/networks";

const apiKey = process.env.EXPO_PUBLIC_ALCHEMY_API_KEY;

if (!apiKey) {
  throw new Error("EXPO_PUBLIC_ALCHEMY_API_KEY is missing");
}

export const ethereumPublicClient = createPublicClient({
  chain: ACTIVE_NETWORK.chain,

  transport: http(`https://${ACTIVE_NETWORK.id}.g.alchemy.com/v2/${apiKey}`),
});
