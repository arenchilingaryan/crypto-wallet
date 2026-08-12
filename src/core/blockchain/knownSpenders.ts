import { getAddress, type Address } from "viem";

/**
 * Курируемый список контрактов, которым кошельки чаще всего выдают
 * разрешения на трату токенов.
 *
 * Почему список, а не скан истории: полный обход событий Approval требует
 * `eth_getLogs` по всему диапазону блоков, который на бесплатном тарифе
 * Alchemy ограничен десятью блоками за запрос. Поэтому экран проверяет
 * известных спендеров и обязан честно писать, сколько именно проверил —
 * пустой список здесь означает «среди известных нет», а не «нет вообще».
 *
 * Каждый адрес проверен: по нему в mainnet лежит задеплоенный контракт.
 */
export type KnownSpender = {
  address: Address;

  name: string;

  /** Для чего этому контракту обычно выдают разрешение. */
  purpose: string;
};

const SPENDERS: Record<string, KnownSpender[]> = {
  "eth-mainnet": [
    {
      address: getAddress("0x000000000022D473030F116dDEE9F6B43aC78BA3"),
      name: "Uniswap Permit2",
      purpose: "Universal token approvals",
    },
    {
      address: getAddress("0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45"),
      name: "Uniswap SwapRouter02",
      purpose: "Swaps",
    },
    {
      address: getAddress("0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD"),
      name: "Uniswap Universal Router",
      purpose: "Swaps",
    },
    {
      address: getAddress("0x66a9893cC07D91D95644AEDD05D03f95e1dBA8Af"),
      name: "Uniswap Universal Router v2",
      purpose: "Swaps",
    },
    {
      address: getAddress("0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"),
      name: "Uniswap V2 Router",
      purpose: "Swaps",
    },
    {
      address: getAddress("0xDef1C0ded9bec7F1a1670819833240f027b25EfF"),
      name: "0x Exchange Proxy",
      purpose: "Aggregated swaps",
    },
    {
      address: getAddress("0x1111111254EEB25477B68fb85Ed929f73A960582"),
      name: "1inch Router v5",
      purpose: "Aggregated swaps",
    },
    {
      address: getAddress("0x111111125421cA6dc452d289314280a0f8842A65"),
      name: "1inch Router v6",
      purpose: "Aggregated swaps",
    },
    {
      address: getAddress("0xC92E8bdf79f0507f65a392b0ab4667716BFE0110"),
      name: "CoW Protocol Relayer",
      purpose: "Aggregated swaps",
    },
    {
      address: getAddress("0x0000000000000068F116a894984e2DB1123eB395"),
      name: "Seaport 1.6",
      purpose: "NFT marketplace orders",
    },
    {
      address: getAddress("0x1E0049783F008A0085193E00003D00cd54003c71"),
      name: "OpenSea Conduit",
      purpose: "NFT marketplace transfers",
    },
    {
      address: getAddress("0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2"),
      name: "Aave V3 Pool",
      purpose: "Lending deposits",
    },
  ],

  "eth-sepolia": [
    {
      address: getAddress("0x000000000022D473030F116dDEE9F6B43aC78BA3"),
      name: "Uniswap Permit2",
      purpose: "Universal token approvals",
    },
    {
      address: getAddress("0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E"),
      name: "Uniswap SwapRouter02",
      purpose: "Swaps",
    },
  ],
};

export function getKnownSpenders(networkId: string): KnownSpender[] {
  return SPENDERS[networkId] ?? [];
}

export function findKnownSpender(
  networkId: string,
  address: Address,
): KnownSpender | null {
  const normalized = address.toLowerCase();

  return (
    getKnownSpenders(networkId).find(
      (spender) => spender.address.toLowerCase() === normalized,
    ) ?? null
  );
}
