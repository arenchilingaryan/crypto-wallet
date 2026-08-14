import {
  UNKNOWN,
  type NormalizedHoneypotHolder,
  type NormalizedHoneypotFlag,
  type NormalizedHoneypotSnapshot,
  type NormalizedHoneypotTopHoldersSnapshot,
  type NormalizedLiquidityPool,
  type NumberValue,
  type SimulationFailureKind,
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
  parseGas,
  parseNonnegativeNumber,
  parsePercentPoints,
  parseRawInteger,
  parseSafeInteger,
  parseText,
  parseTriState,
  parseUnixSeconds,
} from "./parsers";
import { isTokenIntelligenceProviderSupported } from "./support";

const HONEYPOT_CHECK_URL = "https://api.honeypot.is/v2/IsHoneypot";

const HONEYPOT_TOP_HOLDERS_URL =
  "https://api.honeypot.is/v1/TopHolders";

const checkCache = new TokenIntelligenceRequestCache<
  TimedProviderData<NormalizedHoneypotSnapshot>
>();

const holdersCache = new TokenIntelligenceRequestCache<
  TimedProviderData<NormalizedHoneypotTopHoldersSnapshot>
>();

function invalidHoneypotResponse(
  provider: "honeypot-check" | "honeypot-top-holders",
  message: string,
): never {
  throw new TokenIntelligenceProviderError(
    message,
    provider,
    "invalid-response",
  );
}

function parseTokenDecimals(value: unknown): NumberValue {
  const decimals = parseSafeInteger(value);

  return decimals !== UNKNOWN && decimals <= 255 ? decimals : UNKNOWN;
}

function validateReturnedToken(
  value: unknown,
  requestedAddress: string,
) {
  const token = asRecord(value);

  const returnedAddress = normalizeProviderAddress(token && own(token, "address"));

  if (!token || !returnedAddress) {
    return invalidHoneypotResponse(
      "honeypot-check",
      "Honeypot.is returned malformed token metadata",
    );
  }

  if (returnedAddress.toLowerCase() !== requestedAddress.toLowerCase()) {
    return invalidHoneypotResponse(
      "honeypot-check",
      "Honeypot.is returned security data for a different token",
    );
  }

  return token;
}

function normalizeSummaryFlags(
  summaryValue: unknown,
  legacyFlagsValue: unknown,
): readonly NormalizedHoneypotFlag[] {
  const normalizeFlag = (
    entry: unknown,
  ): NormalizedHoneypotFlag | null => {
    if (typeof entry === "string") {
      const code = parseText(entry);

      return code === UNKNOWN
        ? null
        : {
            code,
            description: UNKNOWN,
            severity: UNKNOWN,
          };
    }

    const record = asRecord(entry);
    const code = parseText(record && own(record, "flag"));
    const severityValue = parseText(record && own(record, "severity"));
    const severity =
      severityValue !== UNKNOWN &&
      ["info", "low", "medium", "high", "critical"].includes(
        severityValue.toLowerCase(),
      )
        ? (severityValue.toLowerCase() as Exclude<
            NormalizedHoneypotFlag["severity"],
            typeof UNKNOWN
          >)
        : UNKNOWN;

    return code === UNKNOWN
      ? null
      : {
          code,
          description: parseText(record && own(record, "description")),
          severity,
        };
  };
  const summary = asRecord(summaryValue);

  const flags = summary && own(summary, "flags");

  if (flags !== undefined && flags !== null) {
    if (!Array.isArray(flags)) {
      return [];
    }

    return flags.flatMap((entry) => {
      const flag = normalizeFlag(entry);

      return flag ? [flag] : [];
    });
  }

  if (legacyFlagsValue === undefined || legacyFlagsValue === null) {
    return [];
  }

  if (!Array.isArray(legacyFlagsValue)) {
    return [];
  }

  return legacyFlagsValue.flatMap((entry) => {
    const flag = normalizeFlag(entry);

    return flag ? [flag] : [];
  });
}

export function classifyHoneypotSimulationFailure(
  simulationSuccess: unknown,
  simulationError: unknown,
): SimulationFailureKind {
  if (simulationSuccess !== false) {
    return "unknown";
  }

  const error = parseText(simulationError);

  if (error === UNKNOWN) {
    return "unknown";
  }

  const normalized = error.toLowerCase();

  if (
    /cannot sell|sell (?:is )?(?:blocked|disabled|failed)|sell[_ -]?failed/.test(
      normalized,
    )
  ) {
    return "cannot-sell";
  }

  if (
    /cannot buy|buy (?:is )?(?:blocked|disabled|failed)|buy[_ -]?failed/.test(
      normalized,
    )
  ) {
    return "cannot-buy";
  }

  if (/execution reverted|\brevert(?:ed)?\b/.test(normalized)) {
    return "token-revert";
  }

  if (
    /provider|rpc|timeout|timed out|rate limit|insufficient liquidity|pair not found|network/.test(
      normalized,
    )
  ) {
    return "provider-error";
  }

  return "unknown";
}

function normalizePair(
  value: unknown,
  chainId: number,
  tokenSymbol: unknown,
  pairedTokenSymbol: unknown,
): readonly NormalizedLiquidityPool[] {
  if (value === undefined || value === null) {
    return [];
  }

  const outer = asRecord(value);

  const pair = asRecord(outer && own(outer, "pair"));

  const address = normalizeProviderAddress(pair && own(pair, "address"));

  if (!outer || !pair || !address) {
    return [];
  }

  const returnedChainId = parseSafeInteger(own(outer, "chainId"));

  if (returnedChainId !== UNKNOWN && returnedChainId !== chainId) {
    return [];
  }

  const symbol = parseText(tokenSymbol);

  const pairedSymbol = parseText(pairedTokenSymbol);

  return [
    {
      address,
      dex: parseText(own(pair, "name")),
      pairType: parseText(own(pair, "type")),
      tokenPair:
        symbol === UNKNOWN || pairedSymbol === UNKNOWN
          ? UNKNOWN
          : `${symbol} / ${pairedSymbol}`,
      liquidityUsd: parseNonnegativeNumber(own(outer, "liquidity")),
      router: parseAddressText(own(outer, "router")),
      createdAtMs: parseUnixSeconds(own(outer, "createdAtTimestamp")),
    },
  ];
}

function parseTradeLimit(value: unknown): NumberValue {
  const limit = asRecord(value);

  return limit ? parseNonnegativeNumber(own(limit, "token")) : UNKNOWN;
}

function hasTradeLimit(
  simulationResult: Record<string, unknown> | null,
  key: "maxBuy" | "maxSell",
  simulationSuccess: unknown,
) {
  if (simulationSuccess !== true || !simulationResult) {
    return UNKNOWN;
  }

  const value = own(simulationResult, key);

  if (value === undefined) {
    return false;
  }

  return parseTradeLimit(value) === UNKNOWN ? UNKNOWN : true;
}

export function normalizeHoneypotCheckResponse(
  payload: unknown,
  tokenAddress: string,
  chainId: number,
): NormalizedHoneypotSnapshot {
  const address = normalizeTokenAddress(tokenAddress);

  const root = asRecord(payload);

  if (!root) {
    return invalidHoneypotResponse(
      "honeypot-check",
      "Honeypot.is returned a malformed response",
    );
  }

  const token = validateReturnedToken(own(root, "token"), address);

  const pairedToken = asRecord(own(root, "withToken"));

  const chain = asRecord(own(root, "chain"));

  const returnedChainId = parseSafeInteger(chain && own(chain, "id"));

  if (returnedChainId !== UNKNOWN && returnedChainId !== chainId) {
    return invalidHoneypotResponse(
      "honeypot-check",
      "Honeypot.is returned security data for a different chain",
    );
  }

  const summary = asRecord(own(root, "summary"));

  const simulationSuccess = parseTriState(own(root, "simulationSuccess"));

  const simulationError = parseText(own(root, "simulationError"));

  const honeypot = asRecord(own(root, "honeypotResult"));

  const simulationResult = asRecord(own(root, "simulationResult"));

  const contractCode = asRecord(own(root, "contractCode"));

  return {
    token: {
      totalHolders: parseSafeInteger(own(token, "totalHolders")),
      decimals: parseTokenDecimals(own(token, "decimals")),
    },
    summary: {
      risk: parseText(summary && own(summary, "risk")),
      riskLevel: parseNonnegativeNumber(
        summary && own(summary, "riskLevel"),
        100,
      ),
      flags: normalizeSummaryFlags(summary, own(root, "flags")),
    },
    simulation: {
      success: simulationSuccess,
      error: simulationError,
      failureKind: classifyHoneypotSimulationFailure(
        simulationSuccess,
        simulationError,
      ),
    },
    honeypot: {
      isHoneypot: parseTriState(honeypot && own(honeypot, "isHoneypot")),
      reason: parseText(honeypot && own(honeypot, "honeypotReason")),
    },
    simulationResult: {
      buyTaxPercent: parsePercentPoints(
        simulationResult && own(simulationResult, "buyTax"),
      ),
      sellTaxPercent: parsePercentPoints(
        simulationResult && own(simulationResult, "sellTax"),
      ),
      transferTaxPercent: parsePercentPoints(
        simulationResult && own(simulationResult, "transferTax"),
      ),
      maxBuy: parseTradeLimit(simulationResult && own(simulationResult, "maxBuy")),
      maxSell: parseTradeLimit(
        simulationResult && own(simulationResult, "maxSell"),
      ),
      hasMaxBuyRestriction: hasTradeLimit(
        simulationResult,
        "maxBuy",
        simulationSuccess,
      ),
      hasMaxSellRestriction: hasTradeLimit(
        simulationResult,
        "maxSell",
        simulationSuccess,
      ),
      buyGas: parseGas(simulationResult && own(simulationResult, "buyGas")),
      sellGas: parseGas(simulationResult && own(simulationResult, "sellGas")),
    },
    contractCode: {
      openSource: parseTriState(
        contractCode && own(contractCode, "openSource"),
      ),
      rootOpenSource: parseTriState(
        contractCode && own(contractCode, "rootOpenSource"),
      ),
      isProxy: parseTriState(contractCode && own(contractCode, "isProxy")),
      hasProxyCalls: parseTriState(
        contractCode && own(contractCode, "hasProxyCalls"),
      ),
    },
    pairs: normalizePair(
      own(root, "pair"),
      chainId,
      own(token, "symbol"),
      pairedToken && own(pairedToken, "symbol"),
    ),
  };
}

function normalizeTopHolder(
  value: unknown,
  tokenDecimals: NumberValue,
): NormalizedHoneypotHolder {
  const holder = asRecord(value);

  const address = normalizeProviderAddress(holder && own(holder, "address"));

  if (!holder || !address) {
    return invalidHoneypotResponse(
      "honeypot-top-holders",
      "Honeypot.is returned a malformed top holder",
    );
  }

  return {
    address,
    balance: parseRawInteger(own(holder, "balance"), tokenDecimals),
    alias: parseText(own(holder, "alias")),
    isContract: parseTriState(own(holder, "isContract")),
  };
}

export function normalizeHoneypotTopHoldersResponse(
  payload: unknown,
  tokenDecimals: NumberValue = UNKNOWN,
): NormalizedHoneypotTopHoldersSnapshot {
  const root = asRecord(payload);

  if (!root) {
    return invalidHoneypotResponse(
      "honeypot-top-holders",
      "Honeypot.is returned a malformed top holders response",
    );
  }

  const holders = own(root, "holders");

  if (holders !== undefined && holders !== null && !Array.isArray(holders)) {
    return invalidHoneypotResponse(
      "honeypot-top-holders",
      "Honeypot.is returned a malformed top holders list",
    );
  }

  const holderList = Array.isArray(holders) ? holders : [];

  return {
    totalSupply: parseRawInteger(own(root, "totalSupply"), tokenDecimals),
    holders: holderList
      .slice(0, 50)
      .map((holder) => normalizeTopHolder(holder, tokenDecimals)),
  };
}

export async function getHoneypotCheck({
  chainId,
  tokenAddress,
  forceRefresh = false,
  fetcher,
  signal,
  now = Date.now,
}: ProviderClientOptions): Promise<
  ProviderClientResult<NormalizedHoneypotSnapshot>
> {
  if (!isTokenIntelligenceProviderSupported(chainId, "honeypot-check")) {
    throw new TypeError(`Honeypot.is is unsupported on chain ${chainId}`);
  }

  const address = normalizeTokenAddress(tokenAddress);

  const key = `${chainId}:${address.toLowerCase()}`;

  return checkCache.getOrLoad({
    key,
    ttlMs: TOKEN_INTELLIGENCE_ENDPOINT_CACHE_TTL_MS["honeypot-check"],
    forceRefresh,
    now,
    load: async () => {
      const payload = await requestProviderJson({
        url: `${HONEYPOT_CHECK_URL}?address=${encodeURIComponent(address)}&chainID=${chainId}`,
        provider: "honeypot-check",
        fetcher,
        signal,
        // No custom headers: Honeypot.is currently rejects browser preflights.
      });

      return {
        status: "available",
        observedAt: now(),
        data: normalizeHoneypotCheckResponse(payload, address, chainId),
      };
    },
  });
}

export async function getHoneypotTopHolders({
  chainId,
  tokenAddress,
  forceRefresh = false,
  fetcher,
  signal,
  now = Date.now,
}: ProviderClientOptions): Promise<
  ProviderClientResult<NormalizedHoneypotTopHoldersSnapshot>
> {
  if (
    !isTokenIntelligenceProviderSupported(chainId, "honeypot-top-holders")
  ) {
    throw new TypeError(`Honeypot.is is unsupported on chain ${chainId}`);
  }

  const address = normalizeTokenAddress(tokenAddress);

  const key = `${chainId}:${address.toLowerCase()}`;

  return holdersCache.getOrLoad({
    key,
    ttlMs: TOKEN_INTELLIGENCE_ENDPOINT_CACHE_TTL_MS["honeypot-top-holders"],
    forceRefresh,
    now,
    load: async () => {
      const payload = await requestProviderJson({
        url: `${HONEYPOT_TOP_HOLDERS_URL}?address=${encodeURIComponent(address)}&chainID=${chainId}`,
        provider: "honeypot-top-holders",
        fetcher,
        signal,
        // No custom headers: this v1 endpoint also returns 405 to OPTIONS.
      });

      return {
        status: "available",
        observedAt: now(),
        data: normalizeHoneypotTopHoldersResponse(payload),
      };
    },
  });
}

export function clearHoneypotCaches(): void {
  checkCache.clear();
  holdersCache.clear();
}
