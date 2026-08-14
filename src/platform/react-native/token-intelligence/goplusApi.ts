import {
  UNKNOWN,
  type NormalizedGoPlusHolder,
  type NormalizedGoPlusSnapshot,
  type NormalizedLiquidityPool,
  type NormalizedLockDetail,
  type NormalizedLpHolder,
} from "@/core/token-intelligence/types";

import { normalizeProviderAddress, normalizeTokenAddress } from "./address";
import {
  TOKEN_INTELLIGENCE_ENDPOINT_CACHE_TTL_MS,
  TokenIntelligenceRequestCache,
} from "./cache";
import type {
  ProviderClientOptions,
  ProviderClientResult,
  TimedProviderData,
} from "./clientTypes";
import { TokenIntelligenceProviderError } from "./errors";
import { requestProviderJson } from "./http";
import {
  asRecord,
  own,
  parseAddressText,
  parseDateTime,
  parseDecimalAmount,
  parseGoPlusFractionAsPercent,
  parseNonnegativeNumber,
  parseOwnerAddress,
  parsePoolIdentifier,
  parseSafeInteger,
  parseStringArray,
  parseText,
  parseTriState,
  type UnknownRecord,
} from "./parsers";
import { isTokenIntelligenceProviderSupported } from "./support";

const GOPLUS_BASE_URL =
  "https://api.gopluslabs.io/api/v1/token_security";

const cache = new TokenIntelligenceRequestCache<
  TimedProviderData<NormalizedGoPlusSnapshot>
>();

function invalidGoPlusResponse(message: string): never {
  throw new TokenIntelligenceProviderError(
    message,
    "goplus",
    "invalid-response",
  );
}

function normalizeLockedDetails(value: unknown): readonly NormalizedLockDetail[] {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    return invalidGoPlusResponse("GoPlus returned malformed lock details");
  }

  return value.map((entry) => {
    const record = asRecord(entry);

    if (!record) {
      return invalidGoPlusResponse("GoPlus returned malformed lock details");
    }

    return {
      amount: parseDecimalAmount(own(record, "amount")),
      endTimeMs: parseDateTime(own(record, "end_time")),
    };
  });
}

function normalizeGoPlusHolder(
  entry: unknown,
): NormalizedGoPlusHolder {
  const record = asRecord(entry);

  const address = normalizeProviderAddress(record && own(record, "address"));

  if (!record || !address) {
    return invalidGoPlusResponse("GoPlus returned a malformed holder");
  }

  return {
    address,
    balance: parseDecimalAmount(own(record, "balance")),
    percent: parseGoPlusFractionAsPercent(own(record, "percent")),
    tag: parseText(own(record, "tag")),
    isContract: parseTriState(own(record, "is_contract")),
    isLocked: parseTriState(own(record, "is_locked")),
    lockedDetails: normalizeLockedDetails(own(record, "locked_detail")),
  };
}

function normalizeGoPlusHolders(
  value: unknown,
): readonly NormalizedGoPlusHolder[] {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    return invalidGoPlusResponse("GoPlus returned malformed holders");
  }

  return value.map(normalizeGoPlusHolder);
}

function normalizeLpHolder(entry: unknown): NormalizedLpHolder {
  const holder = normalizeGoPlusHolder(entry);

  return {
    address: holder.address,
    balance: holder.balance,
    percent: holder.percent,
    tag: holder.tag,
    isLocked: holder.isLocked,
    lockedDetails: holder.lockedDetails,
  };
}

function normalizeLpHolders(value: unknown): readonly NormalizedLpHolder[] {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    return invalidGoPlusResponse("GoPlus returned malformed LP holders");
  }

  return value.map(normalizeLpHolder);
}

function normalizeGoPlusPool(entry: unknown): NormalizedLiquidityPool {
  const record = asRecord(entry);

  if (!record) {
    return invalidGoPlusResponse("GoPlus returned a malformed liquidity pool");
  }

  return {
    // UniV4 returns a bytes32 pool id here. Preserve it for display; holder
    // classification only accepts 20-byte addresses.
    address: parsePoolIdentifier(own(record, "pair")),
    dex: parseText(own(record, "name")),
    pairType: parseText(own(record, "liquidity_type")),
    tokenPair: UNKNOWN,
    liquidityUsd: parseNonnegativeNumber(own(record, "liquidity")),
    router: UNKNOWN,
    createdAtMs: UNKNOWN,
  };
}

function normalizeGoPlusPools(
  value: unknown,
): readonly NormalizedLiquidityPool[] {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    return invalidGoPlusResponse("GoPlus returned malformed liquidity data");
  }

  return value.map(normalizeGoPlusPool);
}

function findTokenRecord(
  result: UnknownRecord,
  tokenAddress: string,
): UnknownRecord | null {
  const requested = tokenAddress.toLowerCase();

  for (const [key, value] of Object.entries(result)) {
    if (key.toLowerCase() === requested) {
      return asRecord(value);
    }
  }

  return null;
}

function normalizeFakeToken(value: unknown) {
  const record = asRecord(value);

  return record ? parseTriState(own(record, "value")) : UNKNOWN;
}

export function normalizeGoPlusSecurityResponse(
  payload: unknown,
  tokenAddress: string,
): NormalizedGoPlusSnapshot {
  const address = normalizeTokenAddress(tokenAddress);

  const root = asRecord(payload);

  if (!root) {
    return invalidGoPlusResponse("GoPlus returned a malformed response");
  }

  if (own(root, "code") !== 1) {
    return invalidGoPlusResponse("GoPlus rejected the token security request");
  }

  const result = asRecord(own(root, "result"));

  if (!result) {
    throw new TokenIntelligenceProviderError(
      "GoPlus has no security data for this token",
      "goplus",
      "not-found",
    );
  }

  const token = findTokenRecord(result, address);

  if (!token) {
    throw new TokenIntelligenceProviderError(
      "GoPlus has no security data for this token",
      "goplus",
      "not-found",
    );
  }

  return {
    contract: {
      isOpenSource: parseTriState(own(token, "is_open_source")),
      isProxy: parseTriState(own(token, "is_proxy")),
      isMintable: parseTriState(own(token, "is_mintable")),
      ownerAddress: parseOwnerAddress(own(token, "owner_address")),
      hiddenOwner: parseTriState(own(token, "hidden_owner")),
      canTakeBackOwnership: parseTriState(
        own(token, "can_take_back_ownership"),
      ),
      ownerChangeBalance: parseTriState(own(token, "owner_change_balance")),
      selfDestruct: parseTriState(own(token, "selfdestruct")),
      externalCall: parseTriState(own(token, "external_call")),
    },
    trading: {
      isInDex: parseTriState(own(token, "is_in_dex")),
      buyTaxPercent: parseGoPlusFractionAsPercent(own(token, "buy_tax")),
      sellTaxPercent: parseGoPlusFractionAsPercent(own(token, "sell_tax")),
      transferTaxPercent: parseGoPlusFractionAsPercent(
        own(token, "transfer_tax"),
      ),
      cannotBuy: parseTriState(own(token, "cannot_buy")),
      cannotSellAll: parseTriState(own(token, "cannot_sell_all")),
      slippageModifiable: parseTriState(own(token, "slippage_modifiable")),
      isHoneypot: parseTriState(own(token, "is_honeypot")),
      transferPausable: parseTriState(own(token, "transfer_pausable")),
      isBlacklisted: parseTriState(own(token, "is_blacklisted")),
      isWhitelisted: parseTriState(own(token, "is_whitelisted")),
      isAntiWhale: parseTriState(own(token, "is_anti_whale")),
      antiWhaleModifiable: parseTriState(
        own(token, "anti_whale_modifiable"),
      ),
      tradingCooldown: parseTriState(own(token, "trading_cooldown")),
      personalSlippageModifiable: parseTriState(
        own(token, "personal_slippage_modifiable"),
      ),
    },
    holders: {
      totalHolders: parseSafeInteger(own(token, "holder_count")),
      totalSupply: parseDecimalAmount(own(token, "total_supply")),
      holders: normalizeGoPlusHolders(own(token, "holders")),
      ownerPercent: parseGoPlusFractionAsPercent(
        own(token, "owner_percent"),
      ),
      creatorPercent: parseGoPlusFractionAsPercent(
        own(token, "creator_percent"),
      ),
      creatorAddress: parseAddressText(own(token, "creator_address")),
    },
    liquidity: {
      pools: normalizeGoPlusPools(own(token, "dex")),
      lpHolderCount: parseSafeInteger(own(token, "lp_holder_count")),
      lpTotalSupply: parseDecimalAmount(own(token, "lp_total_supply")),
      lpHolders: normalizeLpHolders(own(token, "lp_holders")),
    },
    additional: {
      isAirdropScam: parseTriState(own(token, "is_airdrop_scam")),
      fakeToken: normalizeFakeToken(own(token, "fake_token")),
      otherPotentialRisks: parseStringArray(
        own(token, "other_potential_risks"),
      ),
      note: parseText(own(token, "note")),
    },
  };
}

export async function getGoPlusSecurity({
  chainId,
  tokenAddress,
  forceRefresh = false,
  fetcher,
  signal,
  now = Date.now,
}: ProviderClientOptions): Promise<
  ProviderClientResult<NormalizedGoPlusSnapshot>
> {
  if (!isTokenIntelligenceProviderSupported(chainId, "goplus")) {
    throw new TypeError(`GoPlus is unsupported on chain ${chainId}`);
  }

  const address = normalizeTokenAddress(tokenAddress);

  const key = `${chainId}:${address.toLowerCase()}`;

  return cache.getOrLoad({
    key,
    ttlMs: TOKEN_INTELLIGENCE_ENDPOINT_CACHE_TTL_MS.goplus,
    forceRefresh,
    now,
    load: async () => {
      const payload = await requestProviderJson({
        url: `${GOPLUS_BASE_URL}/${chainId}?contract_addresses=${encodeURIComponent(address)}`,
        provider: "goplus",
        fetcher,
        signal,
        headers: {
          Accept: "application/json",
        },
      });

      return {
        status: "available",
        observedAt: now(),
        data: normalizeGoPlusSecurityResponse(payload, address),
      };
    },
  });
}

export function clearGoPlusSecurityCache(): void {
  cache.clear();
}
