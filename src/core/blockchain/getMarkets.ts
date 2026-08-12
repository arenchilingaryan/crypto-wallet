import { getAddress, isAddress, type Address } from "viem";

import { ACTIVE_NETWORK } from "@/constants/networks";

/**
 * Рынок токенов активной сети по данным DEX-пулов (GeckoTerminal).
 *
 * Витрина трендов на mainnet по построению выносит наверх свежие пулы,
 * поэтому вместе с ценой всегда отдаём ликвидность, оборот и возраст пула:
 * без них список превращается в рекомендацию покупать что попало.
 */
export type MarketToken = {
  address: Address;

  symbol: string;

  name: string;

  logo: string | null;

  priceUsd: number | null;

  changePercent24h: number | null;

  volumeUsd24h: number | null;

  liquidityUsd: number | null;

  /** Возраст пула в днях; null — дата неизвестна. */
  poolAgeDays: number | null;

  poolName: string;
};

export type MarketList = "trending" | "top";

type GeckoPool = {
  id: string;

  attributes: {
    name?: string;

    base_token_price_usd?: string | null;

    reserve_in_usd?: string | null;

    pool_created_at?: string | null;

    volume_usd?: {
      h24?: string | null;
    };

    price_change_percentage?: {
      h24?: string | null;
    };
  };

  relationships?: {
    base_token?: {
      data?: {
        id?: string;
      };
    };
  };
};

type GeckoToken = {
  id: string;

  type: string;

  attributes: {
    address?: string;
    name?: string;
    symbol?: string;
    image_url?: string | null;
  };
};

type GeckoResponse = {
  data?: GeckoPool[];

  included?: GeckoToken[];
};

function toNumber(value: string | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function toAgeDays(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const created = new Date(value).getTime();

  if (!Number.isFinite(created)) {
    return null;
  }

  return Math.max(0, Math.floor((Date.now() - created) / 86_400_000));
}

export async function getMarkets(list: MarketList): Promise<MarketToken[]> {
  const network = ACTIVE_NETWORK.tokenSearchNetwork;

  // Тестнет DEX-данных не имеет: честнее пустой список, чем чужие цены.
  if (!network) {
    return [];
  }

  const path =
    list === "trending"
      ? `networks/${network}/trending_pools?include=base_token`
      : `networks/${network}/pools?sort=h24_volume_usd_desc&include=base_token`;

  const response = await fetch(`https://api.geckoterminal.com/api/v2/${path}`, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Market request failed: ${response.status}`);
  }

  const result = (await response.json()) as GeckoResponse;

  const tokensById = new Map<string, GeckoToken>();

  for (const token of result.included ?? []) {
    if (token.type === "token") {
      tokensById.set(token.id, token);
    }
  }

  const markets: MarketToken[] = [];

  const seen = new Set<string>();

  for (const pool of result.data ?? []) {
    const tokenId = pool.relationships?.base_token?.data?.id;

    const token = tokenId ? tokensById.get(tokenId) : undefined;

    const rawAddress = token?.attributes.address;

    if (
      !rawAddress ||
      !isAddress(rawAddress, {
        strict: false,
      })
    ) {
      continue;
    }

    const address = getAddress(rawAddress);

    const key = address.toLowerCase();

    // Один токен может держать несколько пулов — оставляем первый,
    // он же самый крупный по сортировке источника.
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    markets.push({
      address,

      symbol: token?.attributes.symbol ?? "—",

      name: token?.attributes.name ?? "Unknown token",

      logo: token?.attributes.image_url ?? null,

      priceUsd: toNumber(pool.attributes.base_token_price_usd),

      changePercent24h: toNumber(pool.attributes.price_change_percentage?.h24),

      volumeUsd24h: toNumber(pool.attributes.volume_usd?.h24),

      liquidityUsd: toNumber(pool.attributes.reserve_in_usd),

      poolAgeDays: toAgeDays(pool.attributes.pool_created_at),

      poolName: pool.attributes.name ?? "",
    });
  }

  return markets;
}
