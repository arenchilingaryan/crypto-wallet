import { getAddress, type Address } from "viem";

// Курируемый реестр токенов для сетей без индексатора имён.
//
// На тестнетах нет реестра токенов: задеплоить «USDC» может кто угодно,
// а текстовый поиск GeckoTerminal живёт на DEX-пулах, которых на Sepolia
// практически нет. Поэтому поиск по символу/имени на тестнете работает
// по этому списку официальных деплоев. Каждый адрес проверен через
// alchemy_getTokenMetadata (символ и decimals совпадают с ончейном).
export type KnownToken = {
  address: Address;

  symbol: string;

  name: string;

  decimals: number;

  logo: string | null;
};

// Логотипы — брендовые картинки тех же токенов из реестра Trust Wallet
// (по мейннет-адресу бренда): тестовые деплои своих картинок не имеют.
function trustWalletLogo(mainnetAddress: string): string {
  return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/${mainnetAddress}/logo.png`;
}

const KNOWN_TOKENS: Record<string, KnownToken[]> = {
  "eth-sepolia": [
    {
      address: getAddress("0x779877A7B0D9E8603169DdbD7836e478b4624789"),
      symbol: "LINK",
      name: "ChainLink Token",
      decimals: 18,
      logo: trustWalletLogo("0x514910771AF9Ca656af840dff83E8264EcF986CA"),
    },
    {
      address: getAddress("0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"),
      symbol: "USDC",
      name: "USDC",
      decimals: 6,
      logo: trustWalletLogo("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"),
    },
    {
      address: getAddress("0x08210F9170F89Ab7658F0B5E3fF39b0E03C594D4"),
      symbol: "EURC",
      name: "EURC",
      decimals: 6,
      logo: trustWalletLogo("0x1aBaEA1f7C830bD89Acc67eC4af516284b1bC33c"),
    },
    {
      address: getAddress("0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14"),
      symbol: "WETH",
      name: "Wrapped Ether",
      decimals: 18,
      logo: trustWalletLogo("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"),
    },
    {
      address: getAddress("0xc4bF5CbDaBE595361438F8c6a187bDc330539c60"),
      symbol: "GHO",
      name: "Gho Token",
      decimals: 18,
      logo: trustWalletLogo("0x40D16FC0246aD3160Ccc09B8D0D3A2cD28aE6C2f"),
    },
    {
      address: getAddress("0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984"),
      symbol: "UNI",
      name: "Uniswap",
      decimals: 18,
      logo: trustWalletLogo("0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984"),
    },
  ],

  // Мейннет ищется по имени через GeckoTerminal — список не нужен.
  "eth-mainnet": [],
};

export function getKnownTokens(networkId: string): KnownToken[] {
  return KNOWN_TOKENS[networkId] ?? [];
}

export function searchKnownTokensByText(
  networkId: string,
  rawQuery: string,
): KnownToken[] {
  const query = rawQuery.trim().toLowerCase();

  if (!query) {
    return [];
  }

  return getKnownTokens(networkId).filter((token) => {
    return (
      token.symbol.toLowerCase().includes(query) ||
      token.name.toLowerCase().includes(query)
    );
  });
}

export function findKnownTokenByAddress(
  networkId: string,
  address: Address,
): KnownToken | null {
  const normalized = address.toLowerCase();

  return (
    getKnownTokens(networkId).find(
      (token) => token.address.toLowerCase() === normalized,
    ) ?? null
  );
}
