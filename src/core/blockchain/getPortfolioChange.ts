import { getAssetMarketData } from "./getAssetMarketData";
import type { Portfolio, PortfolioAsset } from "./getPortfolio";

/**
 * Изменение портфеля за 24 часа.
 *
 * Считается по тем же данным, что рисуют график на экране актива: точка
 * суток назад против текущей спотовой цены. Активы без рыночных данных
 * (тестнет, неизвестный токен) в расчёт не входят вообще — ни в «было»,
 * ни в «стало», иначе процент врал бы на пустом месте.
 */
export type PortfolioChange = {
  totalChangePercent: number | null;

  /** Ключ — assetKey(asset). */
  byAsset: Record<string, number>;
};

export function assetKey(asset: PortfolioAsset): string {
  return asset.type === "native"
    ? "native"
    : (asset.contractAddress?.toLowerCase() ?? asset.symbol.toLowerCase());
}

export async function getPortfolioChange(
  portfolio: Portfolio,
): Promise<PortfolioChange> {
  const results = await Promise.all(
    portfolio.assets.map(async (asset) => {
      const spotPrice = asset.priceUsd;

      const balance = Number(asset.balance);

      if (spotPrice === null || !Number.isFinite(balance)) {
        return null;
      }

      try {
        const marketData = await getAssetMarketData({
          network: portfolio.networkId,

          type: asset.type,

          symbol: asset.symbol,

          contractAddress: asset.contractAddress,

          range: "1D",
        });

        const openPrice = marketData?.points[0]?.priceUsd ?? null;

        if (openPrice === null || openPrice <= 0) {
          return null;
        }

        return {
          key: assetKey(asset),

          changePercent: ((spotPrice - openPrice) / openPrice) * 100,

          valueThen: balance * openPrice,

          valueNow: balance * spotPrice,
        };
      } catch (error) {
        console.error(`Market data failed for ${asset.symbol}:`, error);

        return null;
      }
    }),
  );

  const covered = results.filter((item) => item !== null);

  const byAsset: Record<string, number> = {};

  let totalThen = 0;
  let totalNow = 0;

  for (const item of covered) {
    byAsset[item.key] = item.changePercent;

    totalThen += item.valueThen;
    totalNow += item.valueNow;
  }

  return {
    totalChangePercent:
      totalThen > 0 ? ((totalNow - totalThen) / totalThen) * 100 : null,

    byAsset,
  };
}
