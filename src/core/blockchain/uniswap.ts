import {
  encodeFunctionData,
  encodePacked,
  getAddress,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";

// Uniswap V3 — единственный DEX кошелька. Обмен идёт напрямую через
// контракты: QuoterV2 котирует (eth_call), SwapRouter02 исполняет.
// Никаких сторонних агрегаторов и API-ключей.
//
// Адреса — официальные деплои Uniswap (docs.uniswap.org/contracts/v3),
// по той же схеме Record<networkId, …>, что и knownTokens.

export type UniswapDeployment = {
  swapRouter02: Address;

  quoterV2: Address;

  // Роутер понимает нативный ETH только через WETH9:
  // на входе заворачивает сам (msg.value), на выходе — unwrapWETH9.
  weth9: Address;
};

const DEPLOYMENTS: Record<string, UniswapDeployment> = {
  "eth-mainnet": {
    swapRouter02: getAddress("0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45"),

    quoterV2: getAddress("0x61fFE014bA17989E743c5F6cB21bF9697530B21e"),

    weth9: getAddress("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"),
  },

  "eth-sepolia": {
    swapRouter02: getAddress("0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E"),

    quoterV2: getAddress("0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3"),

    weth9: getAddress("0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14"),
  },
};

export function getUniswapDeployment(
  networkId: string,
): UniswapDeployment | null {
  return DEPLOYMENTS[networkId] ?? null;
}

// Комиссии пулов V3 в сотых долях bps: 0.01% / 0.05% / 0.3% / 1%.
export const POOL_FEE_TIERS = [100, 500, 3000, 10000] as const;

export type PoolFeeTier = (typeof POOL_FEE_TIERS)[number];

// Маршрут фиксируется в момент котировки и валидируется при подписи:
// либо один пул, либо два прыжка через WETH9.
export type SwapRoute =
  | {
      kind: "single";

      fee: PoolFeeTier;
    }
  | {
      kind: "via-weth";

      feeIn: PoolFeeTier;

      feeOut: PoolFeeTier;
    };

// Сентинелы SwapRouter02 (Constants.sol): recipient контракта — для
// промежуточного WETH перед unwrapWETH9.
export const ROUTER_ADDRESS_THIS =
  "0x0000000000000000000000000000000000000002" as Address;

const quoterV2Abi = [
  {
    type: "function",
    name: "quoteExactInputSingle",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "fee", type: "uint24" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "sqrtPriceX96After", type: "uint160" },
      { name: "initializedTicksCrossed", type: "uint32" },
      { name: "gasEstimate", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "quoteExactInput",
    stateMutability: "nonpayable",
    inputs: [
      { name: "path", type: "bytes" },
      { name: "amountIn", type: "uint256" },
    ],
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "sqrtPriceX96AfterList", type: "uint160[]" },
      { name: "initializedTicksCrossedList", type: "uint32[]" },
      { name: "gasEstimate", type: "uint256" },
    ],
  },
] as const;

const swapRouter02Abi = [
  {
    type: "function",
    name: "multicall",
    stateMutability: "payable",
    inputs: [
      { name: "deadline", type: "uint256" },
      { name: "data", type: "bytes[]" },
    ],
    outputs: [{ name: "results", type: "bytes[]" }],
  },
  {
    type: "function",
    name: "exactInputSingle",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "recipient", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "amountOutMinimum", type: "uint256" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
  {
    type: "function",
    name: "exactInput",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "path", type: "bytes" },
          { name: "recipient", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "amountOutMinimum", type: "uint256" },
        ],
      },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
  {
    type: "function",
    name: "unwrapWETH9",
    stateMutability: "payable",
    inputs: [
      { name: "amountMinimum", type: "uint256" },
      { name: "recipient", type: "address" },
    ],
    outputs: [],
  },
] as const;

function encodeViaWethPath(
  tokenIn: Address,
  route: Extract<SwapRoute, { kind: "via-weth" }>,
  weth9: Address,
  tokenOut: Address,
): Hex {
  return encodePacked(
    ["address", "uint24", "address", "uint24", "address"],
    [tokenIn, route.feeIn, weth9, route.feeOut, tokenOut],
  );
}

// Параметры обмена, которых достаточно, чтобы ДЕТЕРМИНИРОВАННО
// восстановить calldata. Подпись сверяет байты через повторную кодировку —
// как encodeErc20Transfer в переводах.
export type SwapCallInput = {
  // Роутинговые адреса: нативный ETH уже заменён на WETH9.
  routeTokenIn: Address;

  routeTokenOut: Address;

  route: SwapRoute;

  // Кошелёк-получатель результата обмена.
  recipient: Address;

  amountIn: bigint;

  minAmountOut: bigint;

  deadline: bigint;

  nativeIn: boolean;

  nativeOut: boolean;

  weth9: Address;
};

export function encodeSwapCalldata(input: SwapCallInput): {
  data: Hex;
  value: bigint;
} {
  // Промежуточный получатель: при выходе в ETH токены WETH остаются
  // на роутере и разворачиваются вторым вызовом мультиколла.
  const swapRecipient = input.nativeOut
    ? ROUTER_ADDRESS_THIS
    : input.recipient;

  const swapCall =
    input.route.kind === "single"
      ? encodeFunctionData({
          abi: swapRouter02Abi,

          functionName: "exactInputSingle",

          args: [
            {
              tokenIn: input.routeTokenIn,

              tokenOut: input.routeTokenOut,

              fee: input.route.fee,

              recipient: swapRecipient,

              amountIn: input.amountIn,

              amountOutMinimum: input.minAmountOut,

              sqrtPriceLimitX96: 0n,
            },
          ],
        })
      : encodeFunctionData({
          abi: swapRouter02Abi,

          functionName: "exactInput",

          args: [
            {
              path: encodeViaWethPath(
                input.routeTokenIn,
                input.route,
                input.weth9,
                input.routeTokenOut,
              ),

              recipient: swapRecipient,

              amountIn: input.amountIn,

              amountOutMinimum: input.minAmountOut,
            },
          ],
        });

  const calls: Hex[] = [swapCall];

  if (input.nativeOut) {
    calls.push(
      encodeFunctionData({
        abi: swapRouter02Abi,

        functionName: "unwrapWETH9",

        args: [input.minAmountOut, input.recipient],
      }),
    );
  }

  const data = encodeFunctionData({
    abi: swapRouter02Abi,

    functionName: "multicall",

    args: [input.deadline, calls],
  });

  return {
    data,

    // ETH на входе едет как msg.value — роутер завернёт его в WETH сам.
    value: input.nativeIn ? input.amountIn : 0n,
  };
}

export type SwapQuoteResult = {
  route: SwapRoute;

  amountOut: bigint;

  // Оценка квотера — газ самого свопа, без 21k и калдаты. Годится
  // для сравнения маршрутов и грубого прогноза до approve.
  quoterGasEstimate: bigint;
};

async function quoteSingle(
  client: PublicClient,
  quoter: Address,
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
  fee: PoolFeeTier,
): Promise<SwapQuoteResult> {
  const { result } = await client.simulateContract({
    address: quoter,

    abi: quoterV2Abi,

    functionName: "quoteExactInputSingle",

    args: [
      {
        tokenIn,

        tokenOut,

        amountIn,

        fee,

        sqrtPriceLimitX96: 0n,
      },
    ],
  });

  return {
    route: {
      kind: "single",
      fee,
    },

    amountOut: result[0],

    quoterGasEstimate: result[3],
  };
}

async function quoteViaWeth(
  client: PublicClient,
  quoter: Address,
  weth9: Address,
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
  feeIn: PoolFeeTier,
  feeOut: PoolFeeTier,
): Promise<SwapQuoteResult> {
  const route: SwapRoute = {
    kind: "via-weth",
    feeIn,
    feeOut,
  };

  const { result } = await client.simulateContract({
    address: quoter,

    abi: quoterV2Abi,

    functionName: "quoteExactInput",

    args: [
      encodeViaWethPath(
        tokenIn,
        route as Extract<SwapRoute, { kind: "via-weth" }>,
        weth9,
        tokenOut,
      ),

      amountIn,
    ],
  });

  return {
    route,

    amountOut: result[0],

    quoterGasEstimate: result[3],
  };
}

// Лучший маршрут: все одиночные пулы плюс — когда ни одна из сторон
// не WETH — два прыжка через WETH по основным тирам. Пулы, которых нет,
// просто реверятся в квотере и выпадают из кандидатов.
export async function quoteBestSwapRoute(
  client: PublicClient,
  deployment: UniswapDeployment,
  routeTokenIn: Address,
  routeTokenOut: Address,
  amountIn: bigint,
): Promise<SwapQuoteResult | null> {
  const candidates: Promise<SwapQuoteResult>[] = POOL_FEE_TIERS.map((fee) =>
    quoteSingle(
      client,
      deployment.quoterV2,
      routeTokenIn,
      routeTokenOut,
      amountIn,
      fee,
    ),
  );

  const wethLeg =
    routeTokenIn.toLowerCase() !== deployment.weth9.toLowerCase() &&
    routeTokenOut.toLowerCase() !== deployment.weth9.toLowerCase();

  if (wethLeg) {
    const hopTiers: PoolFeeTier[] = [500, 3000, 10000];

    for (const feeIn of hopTiers) {
      for (const feeOut of hopTiers) {
        candidates.push(
          quoteViaWeth(
            client,
            deployment.quoterV2,
            deployment.weth9,
            routeTokenIn,
            routeTokenOut,
            amountIn,
            feeIn,
            feeOut,
          ),
        );
      }
    }
  }

  const settled = await Promise.allSettled(candidates);

  let best: SwapQuoteResult | null = null;

  for (const item of settled) {
    if (item.status !== "fulfilled") {
      continue;
    }

    if (item.value.amountOut <= 0n) {
      continue;
    }

    if (!best || item.value.amountOut > best.amountOut) {
      best = item.value;
    }
  }

  return best;
}
