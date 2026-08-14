import { buildTokenIntelligence } from "../src/core/token-intelligence/buildTokenIntelligence";
import { TOKEN_INTELLIGENCE_CACHE_POLICY_MS } from "../src/core/token-intelligence/constants";
import {
  UNKNOWN,
  type BuildTokenIntelligenceInput,
  type NormalizedGoPlusHolder,
  type NormalizedGoPlusSnapshot,
  type NormalizedHoneypotHolder,
  type NormalizedHoneypotSnapshot,
  type NormalizedHoneypotTopHoldersSnapshot,
  type NormalizedLiquidityPool,
  type ProviderSnapshot,
  type TokenAmount,
} from "../src/core/token-intelligence/types";

const NOW = 1_800_000_000_000;

const TOKEN = "0x1000000000000000000000000000000000000000";
const POOL = "0x2000000000000000000000000000000000000000";
const OWNER = "0x3000000000000000000000000000000000000000";
const DEPLOYER = "0x4000000000000000000000000000000000000000";
const BURN = "0x000000000000000000000000000000000000dEaD";

let failed = 0;

function check(label: string, passed: boolean, detail = "") {
  console.log(
    `${passed ? "ok  " : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`,
  );

  if (!passed) {
    failed += 1;
  }
}

function close(actual: number | typeof UNKNOWN, expected: number) {
  return actual !== UNKNOWN && Math.abs(actual - expected) < 0.000_001;
}

function address(index: number) {
  return `0x${index.toString(16).padStart(40, "0")}`;
}

function amount(units: bigint | number, decimals = 0): TokenAmount {
  return {
    units: typeof units === "bigint" ? units : BigInt(units),
    decimals,
  };
}

function rawAmount(units: bigint | number): TokenAmount {
  return {
    units: typeof units === "bigint" ? units : BigInt(units),
    decimals: UNKNOWN,
  };
}

function available<T>(
  data: T,
  observedAt = NOW,
): ProviderSnapshot<T> {
  return {
    status: "available",
    observedAt,
    data,
  };
}

function unavailable<T>(reason = "provider unavailable"): ProviderSnapshot<T> {
  return {
    status: "unavailable",
    attemptedAt: NOW,
    reason,
  };
}

function unsupported<T>(): ProviderSnapshot<T> {
  return {
    status: "unsupported",
    reason: "unsupported network",
  };
}

function pool(
  liquidityUsd: number | typeof UNKNOWN,
  poolAddress: string | typeof UNKNOWN = POOL,
): NormalizedLiquidityPool {
  return {
    address: poolAddress,
    dex: "Uniswap",
    pairType: "V3",
    tokenPair: "TOKEN / WETH",
    liquidityUsd,
    router: UNKNOWN,
    createdAtMs: NOW - 86_400_000,
  };
}

function goHolder({
  holderAddress,
  balance,
  percent,
  tag = UNKNOWN,
  isContract = false,
  isLocked = false,
  lockedDetails = [],
}: {
  holderAddress: string;
  balance: TokenAmount | typeof UNKNOWN;
  percent: number | typeof UNKNOWN;
  tag?: string | typeof UNKNOWN;
  isContract?: boolean | typeof UNKNOWN;
  isLocked?: boolean | typeof UNKNOWN;
  lockedDetails?: NormalizedGoPlusHolder["lockedDetails"];
}): NormalizedGoPlusHolder {
  return {
    address: holderAddress,
    balance,
    percent,
    tag,
    isContract,
    isLocked,
    lockedDetails,
  };
}

function hpHolder({
  holderAddress,
  balance,
  alias = UNKNOWN,
  isContract = false,
}: {
  holderAddress: string;
  balance: TokenAmount | typeof UNKNOWN;
  alias?: string | typeof UNKNOWN;
  isContract?: boolean | typeof UNKNOWN;
}): NormalizedHoneypotHolder {
  return {
    address: holderAddress,
    balance,
    alias,
    isContract,
  };
}

function makeGo({
  contract = {},
  trading = {},
  holders = {},
  liquidity = {},
  additional = {},
}: {
  contract?: Partial<NormalizedGoPlusSnapshot["contract"]>;
  trading?: Partial<NormalizedGoPlusSnapshot["trading"]>;
  holders?: Partial<NormalizedGoPlusSnapshot["holders"]>;
  liquidity?: Partial<NormalizedGoPlusSnapshot["liquidity"]>;
  additional?: Partial<NormalizedGoPlusSnapshot["additional"]>;
} = {}): NormalizedGoPlusSnapshot {
  return {
    contract: {
      isOpenSource: true,
      isProxy: false,
      isMintable: false,
      ownerAddress: UNKNOWN,
      hiddenOwner: false,
      canTakeBackOwnership: false,
      ownerChangeBalance: false,
      selfDestruct: false,
      externalCall: false,
      ...contract,
    },
    trading: {
      isInDex: true,
      buyTaxPercent: 0,
      sellTaxPercent: 0,
      transferTaxPercent: 0,
      cannotBuy: false,
      cannotSellAll: false,
      slippageModifiable: false,
      isHoneypot: false,
      transferPausable: false,
      isBlacklisted: false,
      isWhitelisted: false,
      isAntiWhale: false,
      antiWhaleModifiable: false,
      tradingCooldown: false,
      personalSlippageModifiable: false,
      ...trading,
    },
    holders: {
      totalHolders: 1_000,
      totalSupply: amount(1_000),
      holders: [],
      ownerPercent: UNKNOWN,
      creatorPercent: UNKNOWN,
      creatorAddress: UNKNOWN,
      ...holders,
    },
    liquidity: {
      pools: [pool(500_000)],
      lpHolderCount: UNKNOWN,
      lpTotalSupply: UNKNOWN,
      lpHolders: [],
      ...liquidity,
    },
    additional: {
      isAirdropScam: false,
      fakeToken: false,
      otherPotentialRisks: [],
      note: UNKNOWN,
      ...additional,
    },
  };
}

function makeHoneypot({
  token = {},
  summary = {},
  simulation = {},
  honeypot = {},
  simulationResult = {},
  contractCode = {},
  pairs,
}: {
  token?: Partial<NormalizedHoneypotSnapshot["token"]>;
  summary?: Partial<NormalizedHoneypotSnapshot["summary"]>;
  simulation?: Partial<NormalizedHoneypotSnapshot["simulation"]>;
  honeypot?: Partial<NormalizedHoneypotSnapshot["honeypot"]>;
  simulationResult?: Partial<
    NormalizedHoneypotSnapshot["simulationResult"]
  >;
  contractCode?: Partial<NormalizedHoneypotSnapshot["contractCode"]>;
  pairs?: readonly NormalizedLiquidityPool[];
} = {}): NormalizedHoneypotSnapshot {
  return {
    token: {
      totalHolders: 1_000,
      decimals: 0,
      ...token,
    },
    summary: {
      risk: "low",
      riskLevel: 0,
      flags: [],
      ...summary,
    },
    simulation: {
      success: true,
      error: UNKNOWN,
      failureKind: "unknown",
      ...simulation,
    },
    honeypot: {
      isHoneypot: false,
      reason: UNKNOWN,
      ...honeypot,
    },
    simulationResult: {
      buyTaxPercent: 0,
      sellTaxPercent: 0,
      transferTaxPercent: 0,
      maxBuy: UNKNOWN,
      maxSell: UNKNOWN,
      hasMaxBuyRestriction: false,
      hasMaxSellRestriction: false,
      buyGas: UNKNOWN,
      sellGas: UNKNOWN,
      ...simulationResult,
    },
    contractCode: {
      openSource: true,
      rootOpenSource: true,
      isProxy: false,
      hasProxyCalls: false,
      ...contractCode,
    },
    pairs: pairs ?? [pool(500_000)],
  };
}

function makeTop({
  totalSupply = rawAmount(1_000),
  holders = [],
}: {
  totalSupply?: NormalizedHoneypotTopHoldersSnapshot["totalSupply"];
  holders?: readonly NormalizedHoneypotHolder[];
} = {}): NormalizedHoneypotTopHoldersSnapshot {
  return {
    totalSupply,
    holders,
  };
}

function makeInput({
  goplus = available(makeGo()),
  honeypotCheck = available(makeHoneypot()),
  honeypotTopHolders = available(makeTop()),
  now = NOW,
}: Partial<BuildTokenIntelligenceInput["providers"]> & { now?: number } = {}): BuildTokenIntelligenceInput {
  return {
    token: {
      chainId: 1,
      address: TOKEN,
      symbol: "TOKEN",
      name: "Test Token",
    },
    providers: {
      goplus,
      honeypotCheck,
      honeypotTopHolders,
    },
    now,
  };
}

function build(
  providers: Partial<BuildTokenIntelligenceInput["providers"]> & {
    now?: number;
  } = {},
) {
  return buildTokenIntelligence(makeInput(providers));
}

export async function main() {
  const honeypotConflict = build({
    goplus: available(
      makeGo({
        trading: { isHoneypot: false },
      }),
    ),
    honeypotCheck: available(
      makeHoneypot({
        simulation: { success: false, failureKind: "cannot-sell" },
        honeypot: { isHoneypot: true, reason: "Sell reverted" },
      }),
    ),
  });

  check(
    "honeypot true is a critical trade finding",
    honeypotConflict.tradeSafety.risk.level === "critical" &&
      honeypotConflict.summary.kind === "critical",
    `${honeypotConflict.tradeSafety.risk.level}/${honeypotConflict.summary.kind}`,
  );
  check(
    "GoPlus/Honeypot contradiction remains explicit",
    honeypotConflict.tradeSafety.honeypot.conflict &&
      honeypotConflict.evidence.conflicts.some(
        (item) => item.fact === "Honeypot result",
      ),
  );

  const criticalTradeFlag = build({
    honeypotCheck: available(
      makeHoneypot({
        summary: {
          flags: [
            {
              code: "high_fail_rate",
              description: "A high share of trade simulations failed",
              severity: "critical",
            },
          ],
        },
      }),
    ),
  });

  check(
    "critical Honeypot trade flag stays on Trade with its description",
    criticalTradeFlag.tradeSafety.risk.level === "critical" &&
      criticalTradeFlag.tradeSafety.risk.reasons.some(
        (item) =>
          item.level === "critical" &&
          item.message === "A high share of trade simulations failed",
      ) &&
      !criticalTradeFlag.contractSafety.risk.reasons.some((item) =>
        item.code.includes("high-fail-rate"),
      ),
    `${criticalTradeFlag.tradeSafety.risk.level}/${criticalTradeFlag.contractSafety.risk.level}`,
  );

  const highContractFlag = build({
    honeypotCheck: available(
      makeHoneypot({
        summary: {
          flags: [
            {
              code: "closed_source",
              description: "Contract source is not verified",
              severity: "high",
            },
          ],
        },
      }),
    ),
  });

  check(
    "high closed-source flag stays on Contract and not Trade",
    highContractFlag.contractSafety.risk.level === "high" &&
      highContractFlag.contractSafety.risk.reasons.some(
        (item) =>
          item.level === "high" &&
          item.message === "Contract source is not verified",
      ) &&
      highContractFlag.tradeSafety.risk.level === "low" &&
      !highContractFlag.tradeSafety.risk.reasons.some((item) =>
        item.code.includes("closed-source"),
      ),
    `${highContractFlag.tradeSafety.risk.level}/${highContractFlag.contractSafety.risk.level}`,
  );

  const simulationPassed = build();

  check(
    "successful simulation with no trade warnings can be low risk",
    simulationPassed.tradeSafety.simulationSuccess.value === true &&
      simulationPassed.tradeSafety.risk.level === "low",
    simulationPassed.tradeSafety.risk.level,
  );

  const simulationPassWithUnknownRestrictions = build({
    goplus: available(
      makeGo({
        trading: {
          cannotBuy: UNKNOWN,
          cannotSellAll: UNKNOWN,
          slippageModifiable: UNKNOWN,
          personalSlippageModifiable: UNKNOWN,
          transferPausable: UNKNOWN,
          tradingCooldown: UNKNOWN,
        },
      }),
    ),
  });

  check(
    "simulation pass does not turn unknown trade restrictions into low risk",
    simulationPassWithUnknownRestrictions.tradeSafety.risk.level === "unknown",
    simulationPassWithUnknownRestrictions.tradeSafety.risk.level,
  );

  const unknownContractCapabilities = build({
    goplus: available(
      makeGo({
        contract: {
          isMintable: UNKNOWN,
          hiddenOwner: UNKNOWN,
          canTakeBackOwnership: UNKNOWN,
          ownerChangeBalance: UNKNOWN,
          selfDestruct: UNKNOWN,
          externalCall: UNKNOWN,
        },
        trading: {
          transferPausable: UNKNOWN,
          isBlacklisted: UNKNOWN,
          slippageModifiable: UNKNOWN,
          personalSlippageModifiable: UNKNOWN,
          isAntiWhale: UNKNOWN,
          antiWhaleModifiable: UNKNOWN,
        },
        additional: {
          isAirdropScam: UNKNOWN,
          fakeToken: UNKNOWN,
        },
      }),
    ),
  });

  check(
    "unknown contract capabilities do not become a low-risk contract axis",
    unknownContractCapabilities.contractSafety.risk.level === "unknown",
    unknownContractCapabilities.contractSafety.risk.level,
  );

  const simulationUnavailable = build({
    honeypotCheck: unavailable(),
  });

  check(
    "simulation unavailable is unknown, not high and not low",
    simulationUnavailable.tradeSafety.risk.level === "unknown",
    simulationUnavailable.tradeSafety.risk.level,
  );

  const genericSimulationFailure = build({
    honeypotCheck: available(
      makeHoneypot({
        simulation: {
          success: false,
          error: "upstream RPC timeout",
          failureKind: "provider-error",
        },
      }),
    ),
  });

  check(
    "generic provider failure stays unknown rather than becoming high risk",
    genericSimulationFailure.tradeSafety.risk.level === "unknown",
    genericSimulationFailure.tradeSafety.risk.level,
  );

  const allUnavailable = build({
    goplus: unavailable(),
    honeypotCheck: unavailable(),
    honeypotTopHolders: unavailable(),
  });

  check(
    "all unavailable providers produce unavailable and incomplete, never safe",
    allUnavailable.availability.overall === "unavailable" &&
      allUnavailable.summary.kind === "incomplete" &&
      [
        allUnavailable.tradeSafety.risk.level,
        allUnavailable.contractSafety.risk.level,
        allUnavailable.holders.risk.level,
        allUnavailable.liquidity.risk.level,
      ].every((level) => level === "unknown"),
  );

  const lpExcluded = build({
    goplus: available(
      makeGo({
        holders: {
          holders: [
            goHolder({
              holderAddress: POOL,
              balance: amount(600),
              percent: 60,
              tag: "Uniswap Pool",
              isContract: true,
            }),
            goHolder({
              holderAddress: address(10),
              balance: amount(50),
              percent: 5,
            }),
          ],
        },
      }),
    ),
    honeypotTopHolders: available(
      makeTop({
        holders: [
          hpHolder({ holderAddress: POOL, balance: rawAmount(600), isContract: true }),
          hpHolder({ holderAddress: address(10), balance: rawAmount(50) }),
        ],
      }),
    ),
  });

  check(
    "LP supply is visible but excluded from whale concentration",
    close(lpExcluded.holders.metrics.liquidityPoolPercent.value, 60) &&
      close(lpExcluded.holders.metrics.largestLiquidHolderPercent.value, 5) &&
      lpExcluded.holders.holders.find((item) => item.address === POOL)?.category ===
        "liquidity_pool",
    String(lpExcluded.holders.metrics.largestLiquidHolderPercent.value),
  );

  const burnExcluded = build({
    goplus: available(
      makeGo({
        holders: {
          holders: [
            goHolder({
              holderAddress: BURN,
              balance: amount(500),
              percent: 50,
              tag: "Burn Address",
            }),
            goHolder({
              holderAddress: address(11),
              balance: amount(40),
              percent: 4,
            }),
          ],
        },
      }),
    ),
    honeypotTopHolders: available(
      makeTop({
        holders: [
          hpHolder({ holderAddress: BURN, balance: rawAmount(500) }),
          hpHolder({ holderAddress: address(11), balance: rawAmount(40) }),
        ],
      }),
    ),
  });

  check(
    "burn address is visible but excluded from whale concentration",
    close(burnExcluded.holders.metrics.burnPercent.value, 50) &&
      close(burnExcluded.holders.metrics.largestLiquidHolderPercent.value, 4),
  );

  const fullyLocked = build({
    goplus: available(
      makeGo({
        holders: {
          holders: [
            goHolder({
              holderAddress: address(20),
              balance: amount(400),
              percent: 40,
              isLocked: true,
              lockedDetails: [{ amount: amount(400), endTimeMs: NOW + 60_000 }],
            }),
            goHolder({
              holderAddress: address(21),
              balance: amount(100),
              percent: 10,
            }),
          ],
        },
      }),
    ),
    honeypotTopHolders: available(
      makeTop({
        holders: [
          hpHolder({ holderAddress: address(20), balance: rawAmount(400) }),
          hpHolder({ holderAddress: address(21), balance: rawAmount(100) }),
        ],
      }),
    ),
  });
  const fullLockRecord = fullyLocked.holders.holders.find(
    (item) => item.address === address(20),
  );

  check(
    "active fully locked balance is removed from liquid concentration",
    fullLockRecord?.liquidBalance !== UNKNOWN &&
      fullLockRecord?.liquidBalance.units === 0n &&
      close(fullyLocked.holders.metrics.knownLockedPercent.value, 40) &&
      close(fullyLocked.holders.metrics.largestLiquidHolderPercent.value, 10),
  );

  const partiallyLocked = build({
    goplus: available(
      makeGo({
        holders: {
          holders: [
            goHolder({
              holderAddress: address(22),
              balance: amount(400),
              percent: 40,
              isLocked: true,
              lockedDetails: [{ amount: amount(100), endTimeMs: NOW + 60_000 }],
            }),
          ],
        },
      }),
    ),
    honeypotTopHolders: available(
      makeTop({
        holders: [
          hpHolder({ holderAddress: address(22), balance: rawAmount(400) }),
        ],
      }),
    ),
  });
  const partialLockRecord = partiallyLocked.holders.holders[0];

  check(
    "partial lock subtracts only the proven active amount",
    partialLockRecord.liquidBalance !== UNKNOWN &&
      partialLockRecord.liquidBalance.units === 300n &&
      close(partialLockRecord.liquidPercent, 30) &&
      close(partiallyLocked.holders.metrics.knownLockedPercent.value, 10),
    `${String(partialLockRecord.liquidPercent)}% liquid`,
  );

  const expiredLock = build({
    goplus: available(
      makeGo({
        holders: {
          holders: [
            goHolder({
              holderAddress: address(23),
              balance: amount(400),
              percent: 40,
              isLocked: true,
              lockedDetails: [{ amount: amount(300), endTimeMs: NOW - 1 }],
            }),
          ],
        },
      }),
    ),
    honeypotTopHolders: available(
      makeTop({
        holders: [
          hpHolder({ holderAddress: address(23), balance: rawAmount(400) }),
        ],
      }),
    ),
  });
  const expiredRecord = expiredLock.holders.holders[0];

  check(
    "expired lock evidence remains visible but subtracts zero",
    expiredRecord.lockStatus === "expired" &&
      expiredRecord.liquidBalance !== UNKNOWN &&
      expiredRecord.liquidBalance.units === 400n &&
      close(expiredLock.holders.metrics.knownLockedPercent.value, 0),
  );

  const unquantifiedLock = build({
    goplus: available(
      makeGo({
        holders: {
          holders: [
            goHolder({
              holderAddress: address(24),
              balance: amount(400),
              percent: 40,
              isLocked: true,
              lockedDetails: [{ amount: UNKNOWN, endTimeMs: NOW + 60_000 }],
            }),
          ],
        },
      }),
    ),
    honeypotTopHolders: available(
      makeTop({
        holders: [
          hpHolder({ holderAddress: address(24), balance: rawAmount(400) }),
        ],
      }),
    ),
  });
  const unquantifiedRecord = unquantifiedLock.holders.holders[0];

  check(
    "reported lock with unknown amount is not guessed or subtracted",
    unquantifiedRecord.lockStatus === "active" &&
      unquantifiedRecord.liquidBalance !== UNKNOWN &&
      unquantifiedRecord.liquidBalance.units === 400n,
  );

  const privilegedHolders = build({
    goplus: available(
      makeGo({
        contract: { ownerAddress: OWNER },
        holders: {
          totalHolders: 2,
          creatorAddress: DEPLOYER,
          creatorPercent: 20,
          ownerPercent: 15,
          holders: [
            goHolder({
              holderAddress: DEPLOYER,
              balance: amount(200),
              percent: 20,
              tag: "Creator",
            }),
            goHolder({
              holderAddress: OWNER,
              balance: amount(150),
              percent: 15,
              tag: "Contract Owner",
            }),
          ],
        },
      }),
    ),
    honeypotCheck: available(
      makeHoneypot({ token: { totalHolders: 2 } }),
    ),
    honeypotTopHolders: available(
      makeTop({
        holders: [
          hpHolder({ holderAddress: DEPLOYER, balance: rawAmount(200) }),
          hpHolder({ holderAddress: OWNER, balance: rawAmount(150) }),
        ],
      }),
    ),
  });

  check(
    "deployer remains in liquid concentration",
    privilegedHolders.holders.holders.find(
      (item) => item.address === DEPLOYER.toLowerCase(),
    )?.category === "deployer" &&
      close(privilegedHolders.holders.metrics.deployerPercent.value, 20) &&
      close(privilegedHolders.holders.metrics.largestLiquidHolderPercent.value, 20),
  );
  check(
    "owner remains in liquid concentration",
    privilegedHolders.holders.holders.find(
      (item) => item.address === OWNER.toLowerCase(),
    )?.category === "owner" &&
      close(privilegedHolders.holders.metrics.ownerPercent.value, 15) &&
      close(privilegedHolders.holders.metrics.top10LiquidPercent.value, 35),
  );

  const liquidBalances = [900, 800, 700, 600, 500, 400, 300, 200, 100, 80, 60, 40];
  const deepHolders = [
    hpHolder({ holderAddress: POOL, balance: rawAmount(2_000), isContract: true }),
    hpHolder({ holderAddress: BURN, balance: rawAmount(1_000) }),
    ...liquidBalances.map((balance, index) =>
      hpHolder({ holderAddress: address(100 + index), balance: rawAmount(balance) }),
    ),
  ];
  const deepGoHolders = [
    goHolder({
      holderAddress: POOL,
      balance: amount(2_000),
      percent: 20,
      tag: "Uniswap Pool",
      isContract: true,
    }),
    goHolder({
      holderAddress: BURN,
      balance: amount(1_000),
      percent: 10,
      tag: "Burn Address",
    }),
  ];
  const reranked = build({
    goplus: available(
      makeGo({
        holders: {
          totalSupply: amount(10_000),
          holders: deepGoHolders,
        },
      }),
    ),
    honeypotCheck: available(makeHoneypot({ token: { decimals: 0 } })),
    honeypotTopHolders: available(
      makeTop({
        totalSupply: rawAmount(10_000),
        holders: deepHolders,
      }),
    ),
  });

  check(
    "Top 10 liquid is re-sorted after LP/burn exclusions",
    close(reranked.holders.metrics.top10LiquidPercent.value, 45.8) &&
      reranked.holders.liquidHolders.length === 12 &&
      reranked.holders.liquidHolders[9]?.address === address(109),
    String(reranked.holders.metrics.top10LiquidPercent.value),
  );
  check(
    "Top 10 liquid is not the provider raw top ten with exclusions deleted",
    reranked.holders.metrics.top10LiquidPercent.value !==
      reranked.holders.metrics.rawTop10Percent.value,
    `${String(reranked.holders.metrics.rawTop10Percent.value)} raw vs ${String(
      reranked.holders.metrics.top10LiquidPercent.value,
    )} liquid`,
  );

  const fractionalLock = build({
    goplus: available(
      makeGo({
        holders: {
          totalSupply: amount(100_000, 2),
          holders: [
            goHolder({
              holderAddress: address(250),
              balance: amount(12_345, 2),
              percent: 12.345,
              isLocked: true,
              lockedDetails: [
                { amount: amount(2_345, 2), endTimeMs: NOW + 60_000 },
              ],
            }),
          ],
        },
      }),
    ),
    honeypotCheck: available(makeHoneypot({ token: { decimals: 3 } })),
    honeypotTopHolders: available(
      makeTop({
        totalSupply: rawAmount(1_000_000),
        holders: [
          hpHolder({ holderAddress: address(250), balance: rawAmount(123_450) }),
        ],
      }),
    ),
  });
  const fractionalRecord = fractionalLock.holders.holders[0];

  check(
    "fractional GoPlus amounts align exactly with Honeypot raw units",
    !fractionalRecord.evidence.rawBalance.conflict &&
      fractionalRecord.liquidBalance !== UNKNOWN &&
      fractionalRecord.liquidBalance.units === 100_000n &&
      fractionalRecord.liquidBalance.decimals === 3 &&
      close(fractionalRecord.liquidPercent, 10),
    `${String(fractionalRecord.liquidPercent)}%`,
  );

  const taxConflict = build({
    goplus: available(makeGo({ trading: { sellTaxPercent: 5 } })),
    honeypotCheck: available(
      makeHoneypot({ simulationResult: { sellTaxPercent: 7 } }),
    ),
  });

  check(
    "tax conflict keeps the simulation value and both observations",
    taxConflict.tradeSafety.sellTaxPercent.value === 7 &&
      taxConflict.tradeSafety.sellTaxPercent.conflict &&
      taxConflict.tradeSafety.sellTaxPercent.observations.length === 2 &&
      taxConflict.evidence.conflicts.some((item) => item.fact === "Sell tax"),
  );

  const authoritativeHolderCount = build({
    goplus: available(
      makeGo({ holders: { totalHolders: UNKNOWN, holders: [] } }),
    ),
    honeypotCheck: available(makeHoneypot({ token: { totalHolders: 2_184 } })),
    honeypotTopHolders: available(
      makeTop({
        holders: [
          hpHolder({ holderAddress: address(700), balance: rawAmount(10) }),
        ],
      }),
    ),
  });

  check(
    "total holder count comes from token.totalHolders, not top-holder row count",
    authoritativeHolderCount.holders.metrics.totalHolders.value === 2_184 &&
      authoritativeHolderCount.holders.holders.length === 1,
    `${String(authoritativeHolderCount.holders.metrics.totalHolders.value)} vs ${authoritativeHolderCount.holders.holders.length}`,
  );

  const oneProvider = build({
    honeypotCheck: unavailable(),
    honeypotTopHolders: unavailable(),
  });

  check(
    "one available provider yields partial sections without crashing",
    oneProvider.availability.overall === "partial" &&
      oneProvider.availability.providers.goplus.status === "available" &&
      oneProvider.availability.providers["honeypot-check"].status ===
        "unavailable",
  );

  const unsupportedNetwork = build({
    goplus: unsupported(),
    honeypotCheck: unsupported(),
    honeypotTopHolders: unsupported(),
  });

  check(
    "unsupported network is distinct from zero or unavailable",
    unsupportedNetwork.availability.overall === "unsupported" &&
      unsupportedNetwork.holders.metrics.totalHolders.value === UNKNOWN &&
      unsupportedNetwork.liquidity.totalLiquidityUsd.value === UNKNOWN,
  );

  const noPoolEvidence = build({
    goplus: available(
      makeGo({
        trading: { isInDex: UNKNOWN },
        liquidity: { pools: [] },
      }),
    ),
    honeypotCheck: available(makeHoneypot({ pairs: [] })),
  });

  check(
    "empty or omitted pool arrays are no evidence, not zero liquidity",
    noPoolEvidence.liquidity.totalLiquidityUsd.value === UNKNOWN &&
      noPoolEvidence.liquidity.risk.level === "unknown",
    `${String(noPoolEvidence.liquidity.totalLiquidityUsd.value)}/${noPoolEvidence.liquidity.risk.level}`,
  );

  const staleAt = NOW - TOKEN_INTELLIGENCE_CACHE_POLICY_MS.contract - 1;
  const stale = build({
    goplus: available(makeGo(), staleAt),
    honeypotCheck: available(makeHoneypot(), staleAt),
    honeypotTopHolders: available(makeTop(), staleAt),
  });

  check(
    "stale snapshots are explicitly marked stale",
    stale.freshness.trade === "stale" &&
      stale.freshness.contract === "stale" &&
      stale.freshness.holders === "stale" &&
      stale.freshness.liquidity === "stale",
  );

  const duplicateAddress = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
  const duplicate = build({
    goplus: available(
      makeGo({
        holders: {
          totalSupply: amount(100_000, 2),
          holders: [
            goHolder({
              holderAddress: duplicateAddress.toUpperCase(),
              balance: amount(1_000, 2),
              percent: 1,
            }),
          ],
        },
      }),
    ),
    honeypotCheck: available(makeHoneypot({ token: { decimals: 4 } })),
    honeypotTopHolders: available(
      makeTop({
        totalSupply: rawAmount(10_000_000),
        holders: [
          hpHolder({
            holderAddress: duplicateAddress.toLowerCase(),
            balance: rawAmount(100_000),
          }),
        ],
      }),
    ),
  });

  check(
    "duplicate holder addresses merge case-insensitively without false conflict",
    duplicate.holders.holders.length === 1 &&
      duplicate.holders.holders[0].address === duplicateAddress &&
      !duplicate.holders.holders[0].evidence.rawBalance.conflict,
    String(duplicate.holders.holders.length),
  );

  const v4PoolId = `0x${"ab".repeat(32)}`;
  const holderLookingLikeV4Prefix = `0x${"ab".repeat(20)}`;
  const bytes32Pair = build({
    goplus: available(makeGo({ liquidity: { pools: [pool(500_000, v4PoolId)] } })),
    honeypotCheck: available(makeHoneypot({ pairs: [pool(500_000, v4PoolId)] })),
    honeypotTopHolders: available(
      makeTop({
        holders: [
          hpHolder({ holderAddress: holderLookingLikeV4Prefix, balance: rawAmount(100) }),
        ],
      }),
    ),
  });

  check(
    "UniV4 bytes32 pair ids are not classified as holder addresses",
    bytes32Pair.holders.holders[0]?.category === "wallet",
    bytes32Pair.holders.holders[0]?.category,
  );

  const lpTokenHolder = address(900);
  const lpHoldersIgnored = build({
    goplus: available(
      makeGo({
        liquidity: {
          lpHolders: [
            {
              address: lpTokenHolder,
              balance: amount(900),
              percent: 90,
              tag: "LP holder",
              isLocked: false,
              lockedDetails: [],
            },
          ],
        },
      }),
    ),
    honeypotTopHolders: available(
      makeTop({
        holders: [
          hpHolder({ holderAddress: address(901), balance: rawAmount(10) }),
        ],
      }),
    ),
  });

  check(
    "LP-token holders are never merged into token holders",
    !lpHoldersIgnored.holders.holders.some(
      (holder) => holder.address === lpTokenHolder,
    ),
  );

  const malformedPercent = build({
    goplus: available(
      makeGo({
        holders: {
          holders: [
            goHolder({
              holderAddress: address(950),
              balance: UNKNOWN,
              percent: Number.NaN,
            }),
          ],
        },
      }),
    ),
    honeypotTopHolders: available(
      makeTop({
        holders: [
          hpHolder({ holderAddress: address(950), balance: UNKNOWN }),
        ],
      }),
    ),
  });

  check(
    "malformed percentages become unknown rather than NaN or zero",
    malformedPercent.holders.holders[0]?.rawPercent === UNKNOWN &&
      malformedPercent.holders.metrics.top10LiquidPercent.value === UNKNOWN,
    String(malformedPercent.holders.holders[0]?.rawPercent),
  );

  const malformedLiquidity = build({
    goplus: available(makeGo({ liquidity: { pools: [pool(Number.NaN)] } })),
    honeypotCheck: available(makeHoneypot({ pairs: [] })),
  });

  check(
    "NaN liquidity becomes unknown rather than a numeric risk input",
    malformedLiquidity.liquidity.totalLiquidityUsd.value === UNKNOWN &&
      malformedLiquidity.liquidity.risk.level === "unknown",
    String(malformedLiquidity.liquidity.totalLiquidityUsd.value),
  );

  const emptyProviderValue = build({
    goplus: available(
      makeGo({
        trading: {
          isHoneypot: "" as unknown as boolean,
        },
      }),
    ),
    honeypotCheck: unavailable(),
  });

  check(
    "provider empty string is rejected instead of becoming false/safe",
    emptyProviderValue.tradeSafety.honeypot.value === UNKNOWN &&
      emptyProviderValue.tradeSafety.risk.level === "unknown",
    `${String(emptyProviderValue.tradeSafety.honeypot.value)}/${emptyProviderValue.tradeSafety.risk.level}`,
  );

  const numericProviderFlag = build({
    goplus: available(
      makeGo({
        trading: {
          isHoneypot: 0 as unknown as boolean,
        },
      }),
    ),
    honeypotCheck: unavailable(),
  });

  check(
    "numeric provider flags must be normalized before domain use",
    numericProviderFlag.tradeSafety.honeypot.value === UNKNOWN,
    String(numericProviderFlag.tradeSafety.honeypot.value),
  );

  const zeroSupply = build({
    goplus: available(
      makeGo({
        holders: {
          totalSupply: amount(0),
          holders: [
            goHolder({
              holderAddress: address(960),
              balance: amount(100),
              percent: 10,
            }),
          ],
        },
      }),
    ),
    honeypotTopHolders: available(
      makeTop({
        totalSupply: rawAmount(0),
        holders: [
          hpHolder({ holderAddress: address(960), balance: rawAmount(100) }),
        ],
      }),
    ),
  });

  check(
    "zero total supply cannot yield holder percentages",
    zeroSupply.holders.metrics.rawTop10Percent.value === UNKNOWN &&
      zeroSupply.holders.metrics.top10LiquidPercent.value === UNKNOWN,
    `${String(zeroSupply.holders.metrics.rawTop10Percent.value)}/${String(
      zeroSupply.holders.metrics.top10LiquidPercent.value,
    )}`,
  );

  const mixedKnownUnknownHolders = build({
    goplus: available(makeGo({ holders: { holders: [] } })),
    honeypotTopHolders: available(
      makeTop({
        totalSupply: rawAmount(1_000),
        holders: [
          hpHolder({ holderAddress: address(970), balance: rawAmount(10) }),
          hpHolder({ holderAddress: address(971), balance: UNKNOWN }),
        ],
      }),
    ),
  });

  check(
    "an unknown holder share makes concentration unknown instead of a low numeric sum",
    mixedKnownUnknownHolders.holders.metrics.top10LiquidPercent.value ===
      UNKNOWN && mixedKnownUnknownHolders.holders.risk.level === "unknown",
    `${String(
      mixedKnownUnknownHolders.holders.metrics.top10LiquidPercent.value,
    )}/${mixedKnownUnknownHolders.holders.risk.level}`,
  );

  const truncatedTopHolders = build({
    honeypotTopHolders: available(
      makeTop({
        totalSupply: rawAmount(1_000),
        holders: [
          hpHolder({ holderAddress: address(973), balance: rawAmount(10) }),
        ],
      }),
    ),
  });

  check(
    "a short top-holder response is incomplete rather than a low concentration",
    truncatedTopHolders.holders.metrics.top10LiquidPercent.value === UNKNOWN &&
      truncatedTopHolders.holders.risk.level === "unknown",
  );

  const holderConflict = build({
    goplus: available(
      makeGo({
        holders: {
          totalHolders: 999,
          holders: [
            goHolder({
              holderAddress: address(972),
              balance: amount(100),
              percent: 10,
            }),
          ],
        },
      }),
    ),
    honeypotTopHolders: available(
      makeTop({
        totalSupply: rawAmount(1_000),
        holders: [
          hpHolder({ holderAddress: address(972), balance: rawAmount(200) }),
        ],
      }),
    ),
  });

  check(
    "holder and total-count contradictions are explicit and lower confidence",
    holderConflict.holders.conflicts.some((item) =>
      item.fact.includes("raw share"),
    ) &&
      holderConflict.evidence.conflicts.some(
        (item) => item.fact === "Total holder count",
      ) &&
      holderConflict.holders.metrics.totalHolders.value === 1_000 &&
      holderConflict.holders.metrics.totalHolders.quality === "partial" &&
      holderConflict.holders.risk.confidence === "partial",
  );

  const highLiquidityHoneypot = build({
    goplus: available(makeGo({ liquidity: { pools: [pool(10_000_000)] } })),
    honeypotCheck: available(
      makeHoneypot({
        honeypot: { isHoneypot: true, reason: "Sell blocked" },
        simulation: { success: false, failureKind: "cannot-sell" },
        pairs: [pool(10_000_000)],
      }),
    ),
  });

  check(
    "high liquidity never overrides a honeypot critical finding",
    highLiquidityHoneypot.liquidity.risk.level === "low" &&
      highLiquidityHoneypot.tradeSafety.risk.level === "critical" &&
      highLiquidityHoneypot.summary.kind === "critical",
  );

  const summaryTitles = [
    honeypotConflict.summary.title,
    simulationPassed.summary.title,
    allUnavailable.summary.title,
  ];

  check(
    "domain summaries never claim SAFE",
    summaryTitles.every((title) => !/\bsafe\b/i.test(title)),
    summaryTitles.join(" | "),
  );

  console.log(
    failed === 0
      ? "\nAll Token Intelligence semantic checks passed"
      : `\nFAILED Token Intelligence checks: ${failed}`,
  );

  if (failed > 0) {
    throw new Error(`${failed} Token Intelligence semantic check(s) failed`);
  }
}
