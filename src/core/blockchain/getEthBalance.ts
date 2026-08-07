import { createPublicClient, formatEther, http, type Address } from "viem";
import { sepolia } from "viem/chains";

const client = createPublicClient({
  chain: sepolia,
  transport: http(),
});

export async function getEthBalance(address: Address) {
  const balance = await client.getBalance({
    address,
  });

  return {
    raw: balance,
    formatted: formatEther(balance),
  };
}
