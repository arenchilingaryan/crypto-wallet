import { getPortfolio } from "@/core/blockchain/getPortfolio";

import { toAmountUsd } from "@/core/security/policyDecision";

import { walletEngine } from "./compositionRoot";

export async function priceTag(
  symbol: string,
  amount: string,
): Promise<number | null> {
  try {
    const wallet = await walletEngine.getActive();

    if (!wallet) {
      return null;
    }

    const portfolio = await getPortfolio(wallet.address);

    const asset = portfolio.assets.find(
      (item) => item.symbol.toLowerCase() === symbol.toLowerCase(),
    );

    return toAmountUsd(amount, asset?.priceUsd ?? null);
  } catch {
    return null;
  }
}
