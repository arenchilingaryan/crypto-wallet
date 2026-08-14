export const UNKNOWN = "unknown" as const;

export type Unknown = typeof UNKNOWN;
export type KnownOrUnknown<T> = T | Unknown;
export type TriState = KnownOrUnknown<boolean>;
export type NumberValue = KnownOrUnknown<number>;
export type TextValue = KnownOrUnknown<string>;

export type TokenAmount = {
  units: bigint;
  decimals: NumberValue;
};

export type BalanceValue = KnownOrUnknown<TokenAmount>;

export type ProviderId =
  | "goplus"
  | "honeypot-check"
  | "honeypot-top-holders";

export type ProviderSnapshot<T> =
  | {
      status: "unsupported";
      reason: string;
    }
  | {
      status: "loading";
      requestedAt: number;
    }
  | {
      status: "unavailable";
      attemptedAt: number;
      reason: string;
    }
  | {
      status: "available";
      observedAt: number;
      data: T;
    };

export type ProviderStatus = ProviderSnapshot<unknown>["status"];

export type Availability =
  | "unsupported"
  | "loading"
  | "available"
  | "partial"
  | "unavailable";

export type Freshness = "fresh" | "stale" | "unknown";

export type ProviderAvailability = {
  status: Exclude<Availability, "partial">;
  observedAt: NumberValue;
  reason: TextValue;
};

export type IntelligenceAvailability = {
  overall: Availability;
  trade: Availability;
  contract: Availability;
  holders: Availability;
  liquidity: Availability;
  providers: Record<ProviderId, ProviderAvailability>;
};

export type EvidenceObservation<T> = {
  source: ProviderId;
  value: KnownOrUnknown<T>;
  observedAt: number;
};

export type EvidenceResolution =
  | "none"
  | "single-source"
  | "consensus"
  | "preferred-source"
  | "conservative"
  | "unresolved-conflict";

export type Evidence<T> = {
  value: KnownOrUnknown<T>;
  observations: readonly EvidenceObservation<T>[];
  conflict: boolean;
  resolution: EvidenceResolution;
};

export type EvidenceConflict = {
  fact: string;
  observations: readonly {
    source: ProviderId;
    value: string;
    observedAt: number;
  }[];
};

export type RiskLevel = "low" | "medium" | "high" | "critical" | "unknown";
export type RiskConfidence = "full" | "partial" | "unknown";

export type RiskReason = {
  code: string;
  level: Exclude<RiskLevel, "low" | "unknown"> | "info";
  message: string;
  sources: readonly ProviderId[];
};

export type RiskResult = {
  level: RiskLevel;
  confidence: RiskConfidence;
  reasons: readonly RiskReason[];
};

export type HolderCategory =
  | "wallet"
  | "contract"
  | "liquidity_pool"
  | "burn"
  | "locked"
  | "deployer"
  | "owner"
  | "unknown_contract";

export type HolderLockStatus =
  | "none"
  | "active"
  | "expired"
  | "reported-unquantified";

export type MetricQuality = "complete" | "partial" | "unknown";

export type DomainMetric<T> = {
  value: KnownOrUnknown<T>;
  quality: MetricQuality;
  sources: readonly ProviderId[];
};

export type NormalizedLockDetail = {
  amount: BalanceValue;
  endTimeMs: NumberValue;
};

export type NormalizedGoPlusHolder = {
  address: string;
  balance: BalanceValue;
  percent: NumberValue;
  tag: TextValue;
  isContract: TriState;
  isLocked: TriState;
  lockedDetails: readonly NormalizedLockDetail[];
};

export type NormalizedHoneypotHolder = {
  address: string;
  balance: BalanceValue;
  alias: TextValue;
  isContract: TriState;
};

export type NormalizedLpHolder = {
  address: string;
  balance: BalanceValue;
  percent: NumberValue;
  tag: TextValue;
  isLocked: TriState;
  lockedDetails: readonly NormalizedLockDetail[];
};

export type NormalizedLiquidityPool = {
  address: TextValue;
  dex: TextValue;
  pairType: TextValue;
  tokenPair: TextValue;
  liquidityUsd: NumberValue;
  router: TextValue;
  createdAtMs: NumberValue;
};

export type NormalizedGoPlusSnapshot = {
  contract: {
    isOpenSource: TriState;
    isProxy: TriState;
    isMintable: TriState;
    ownerAddress: TextValue;
    hiddenOwner: TriState;
    canTakeBackOwnership: TriState;
    ownerChangeBalance: TriState;
    selfDestruct: TriState;
    externalCall: TriState;
  };
  trading: {
    isInDex: TriState;
    buyTaxPercent: NumberValue;
    sellTaxPercent: NumberValue;
    transferTaxPercent: NumberValue;
    cannotBuy: TriState;
    cannotSellAll: TriState;
    slippageModifiable: TriState;
    isHoneypot: TriState;
    transferPausable: TriState;
    isBlacklisted: TriState;
    isWhitelisted: TriState;
    isAntiWhale: TriState;
    antiWhaleModifiable: TriState;
    tradingCooldown: TriState;
    personalSlippageModifiable: TriState;
  };
  holders: {
    totalHolders: NumberValue;
    totalSupply: BalanceValue;
    holders: readonly NormalizedGoPlusHolder[];
    ownerPercent: NumberValue;
    creatorPercent: NumberValue;
    creatorAddress: TextValue;
  };
  liquidity: {
    pools: readonly NormalizedLiquidityPool[];
    lpHolderCount: NumberValue;
    lpTotalSupply: BalanceValue;
    lpHolders: readonly NormalizedLpHolder[];
  };
  additional: {
    isAirdropScam: TriState;
    fakeToken: TriState;
    otherPotentialRisks: readonly string[];
    note: TextValue;
  };
};

export type SimulationFailureKind =
  | "cannot-sell"
  | "cannot-buy"
  | "token-revert"
  | "provider-error"
  | "unknown";

export type NormalizedHoneypotFlag = {
  code: string;
  description: TextValue;
  severity:
    | "info"
    | "low"
    | "medium"
    | "high"
    | "critical"
    | Unknown;
};

export type NormalizedHoneypotSnapshot = {
  token: {
    totalHolders: NumberValue;
    decimals: NumberValue;
  };
  summary: {
    risk: TextValue;
    riskLevel: NumberValue;
    flags: readonly NormalizedHoneypotFlag[];
  };
  simulation: {
    success: TriState;
    error: TextValue;
    failureKind: SimulationFailureKind;
  };
  honeypot: {
    isHoneypot: TriState;
    reason: TextValue;
  };
  simulationResult: {
    buyTaxPercent: NumberValue;
    sellTaxPercent: NumberValue;
    transferTaxPercent: NumberValue;
    maxBuy: NumberValue;
    maxSell: NumberValue;
    hasMaxBuyRestriction: TriState;
    hasMaxSellRestriction: TriState;
    buyGas: NumberValue;
    sellGas: NumberValue;
  };
  contractCode: {
    openSource: TriState;
    rootOpenSource: TriState;
    isProxy: TriState;
    hasProxyCalls: TriState;
  };
  pairs: readonly NormalizedLiquidityPool[];
};

export type NormalizedHoneypotTopHoldersSnapshot = {
  totalSupply: BalanceValue;
  holders: readonly NormalizedHoneypotHolder[];
};

export type TokenIdentity = {
  chainId: number;
  address: string;
  symbol: TextValue;
  name: TextValue;
};

export type HolderRecord = {
  address: string;
  label: string;
  category: HolderCategory;
  isContract: TriState;
  isLocked: TriState;
  lockStatus: HolderLockStatus;
  lockDetails: readonly NormalizedLockDetail[];
  rawBalance: BalanceValue;
  rawPercent: NumberValue;
  lockedBalance: BalanceValue;
  liquidBalance: BalanceValue;
  liquidPercent: NumberValue;
  evidence: {
    rawBalance: Evidence<TokenAmount>;
    rawPercent: Evidence<number>;
    isContract: Evidence<boolean>;
    isLocked: Evidence<boolean>;
  };
};

export type HolderMetrics = {
  totalHolders: DomainMetric<number>;
  rawTop10Percent: DomainMetric<number>;
  largestLiquidHolderPercent: DomainMetric<number>;
  top5LiquidPercent: DomainMetric<number>;
  top10LiquidPercent: DomainMetric<number>;
  deployerPercent: DomainMetric<number>;
  ownerPercent: DomainMetric<number>;
  burnPercent: DomainMetric<number>;
  liquidityPoolPercent: DomainMetric<number>;
  knownLockedPercent: DomainMetric<number>;
};

export type HolderDistribution = {
  availability: Availability;
  quality: MetricQuality;
  totalSupply: DomainMetric<TokenAmount>;
  metrics: HolderMetrics;
  holders: readonly HolderRecord[];
  liquidHolders: readonly HolderRecord[];
  conflicts: readonly EvidenceConflict[];
  risk: RiskResult;
};

export type TradeIntelligence = {
  simulationSuccess: Evidence<boolean>;
  simulationError: Evidence<string>;
  simulationFailureKind: Evidence<SimulationFailureKind>;
  honeypot: Evidence<boolean>;
  honeypotReason: Evidence<string>;
  buyTaxPercent: Evidence<number>;
  sellTaxPercent: Evidence<number>;
  transferTaxPercent: Evidence<number>;
  cannotBuy: Evidence<boolean>;
  cannotSellAll: Evidence<boolean>;
  slippageModifiable: Evidence<boolean>;
  personalSlippageModifiable: Evidence<boolean>;
  transferPausable: Evidence<boolean>;
  tradingCooldown: Evidence<boolean>;
  hasMaxBuyRestriction: Evidence<boolean>;
  hasMaxSellRestriction: Evidence<boolean>;
  maxBuy: Evidence<number>;
  maxSell: Evidence<number>;
  risk: RiskResult;
};

export type ContractIntelligence = {
  isOpenSource: Evidence<boolean>;
  rootOpenSource: Evidence<boolean>;
  isProxy: Evidence<boolean>;
  hasProxyCalls: Evidence<boolean>;
  isMintable: Evidence<boolean>;
  ownerAddress: Evidence<string>;
  hiddenOwner: Evidence<boolean>;
  canTakeBackOwnership: Evidence<boolean>;
  ownerChangeBalance: Evidence<boolean>;
  selfDestruct: Evidence<boolean>;
  externalCall: Evidence<boolean>;
  transferPausable: Evidence<boolean>;
  isBlacklisted: Evidence<boolean>;
  slippageModifiable: Evidence<boolean>;
  personalSlippageModifiable: Evidence<boolean>;
  antiWhale: Evidence<boolean>;
  antiWhaleModifiable: Evidence<boolean>;
  isAirdropScam: Evidence<boolean>;
  fakeToken: Evidence<boolean>;
  otherPotentialRisks: readonly string[];
  note: Evidence<string>;
  risk: RiskResult;
};

export type LiquidityPool = {
  address: TextValue;
  dex: TextValue;
  pairType: TextValue;
  tokenPair: TextValue;
  liquidityUsd: NumberValue;
  router: TextValue;
  createdAtMs: NumberValue;
  source: ProviderId;
  observedAt: number;
};

export type LiquidityIntelligence = {
  availability: Availability;
  totalLiquidityUsd: DomainMetric<number>;
  pools: readonly LiquidityPool[];
  risk: RiskResult;
};

export type TokenSafetySummary = {
  kind: "critical" | "high" | "incomplete" | "no-major-issues";
  title: string;
  detectedRiskCount: number;
};

export type TokenIntelligenceFreshness = {
  trade: Freshness;
  contract: Freshness;
  holders: Freshness;
  liquidity: Freshness;
};

export type TokenIntelligence = {
  token: TokenIdentity;
  tradeSafety: TradeIntelligence;
  contractSafety: ContractIntelligence;
  holders: HolderDistribution;
  liquidity: LiquidityIntelligence;
  summary: TokenSafetySummary;
  evidence: {
    conflicts: readonly EvidenceConflict[];
  };
  availability: IntelligenceAvailability;
  freshness: TokenIntelligenceFreshness;
  observedAt: NumberValue;
};

export type BuildTokenIntelligenceInput = {
  token: TokenIdentity;
  providers: {
    goplus: ProviderSnapshot<NormalizedGoPlusSnapshot>;
    honeypotCheck: ProviderSnapshot<NormalizedHoneypotSnapshot>;
    honeypotTopHolders: ProviderSnapshot<NormalizedHoneypotTopHoldersSnapshot>;
  };
  now: number;
};
