import { UNKNOWN } from "@/core/token-intelligence/types";

import { clearGoPlusSecurityCache, normalizeGoPlusSecurityResponse } from "./goplusApi";
import {
  clearHoneypotCaches,
  normalizeHoneypotCheckResponse,
  normalizeHoneypotTopHoldersResponse,
} from "./honeypotApi";
import type { TokenIntelligenceFetch } from "./http";
import { loadTokenIntelligence } from "./tokenIntelligenceApi";

const TOKEN = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const OTHER_TOKEN = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
const HOLDER = "0x000000000000000000000000000000000000dEaD";
const UNIV4_POOL_ID =
  "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (!Object.is(actual, expected)) {
    throw new Error(
      `${message}: expected ${String(expected)}, received ${String(actual)}`,
    );
  }
}

function assertThrows(run: () => unknown, message: string): void {
  let threw = false;

  try {
    run();
  } catch {
    threw = true;
  }

  assert(threw, message);
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function goPlusPayload() {
  return {
    code: 1,
    message: "OK",
    result: {
      [TOKEN.toLowerCase()]: {
        buy_tax: "0.003",
        sell_tax: "0.01",
        transfer_tax: "0",
        holder_count: "42",
        total_supply: "12.3400",
        dex: [
          {
            pair: UNIV4_POOL_ID,
            name: "UniswapV4",
            liquidity_type: "UniV4",
            liquidity: "250000",
          },
        ],
        holders: [
          {
            address: HOLDER,
            balance: "2.500",
            percent: "0.2",
            is_contract: "0",
            is_locked: "1",
            locked_detail: [
              {
                amount: "1.250",
                end_time: "2023-08-02T12:00:00+04:00",
              },
              {
                amount: "0.250",
                end_time: "1690963200",
              },
            ],
          },
        ],
      },
    },
  };
}

function honeypotPayload() {
  return {
    token: {
      address: TOKEN,
      decimals: 18,
      totalHolders: 43,
      symbol: "WETH",
    },
    chain: {
      id: "1",
    },
    summary: {
      risk: "low",
      riskLevel: 1,
      flags: [
        {
          flag: "TRANSFER_BLOCKED",
          description: "Transfers can be restricted",
          severity: "high",
        },
      ],
    },
    simulationSuccess: true,
    simulationResult: {
      buyTax: 0.29,
      sellTax: 0.3,
      transferTax: 0,
      buyGas: "120000",
      sellGas: "150000",
    },
    honeypotResult: {
      isHoneypot: false,
    },
  };
}

function topHoldersPayload() {
  return {
    totalSupply: "1000000000000000000",
    holders: [
      {
        address: HOLDER,
        balance: "250000000000000000",
        alias: "Burn Address",
        isContract: false,
      },
    ],
  };
}

function responseFor(url: string): Response {
  if (url.includes("gopluslabs")) {
    return jsonResponse(goPlusPayload());
  }

  if (url.includes("IsHoneypot")) {
    return jsonResponse(honeypotPayload());
  }

  if (url.includes("TopHolders")) {
    return jsonResponse(topHoldersPayload());
  }

  return jsonResponse({}, 404);
}

async function testGoPlusNormalization(): Promise<void> {
  const normalized = normalizeGoPlusSecurityResponse(goPlusPayload(), TOKEN);

  assertEqual(
    normalized.trading.buyTaxPercent,
    0.3,
    "GoPlus tax fractions must become percent points",
  );
  assertEqual(
    normalized.holders.holders[0]?.percent,
    20,
    "GoPlus holder fractions must become percent points",
  );
  assert(
    normalized.holders.totalSupply !== UNKNOWN,
    "GoPlus total supply should parse losslessly",
  );
  assertEqual(
    normalized.holders.totalSupply.units,
    123400n,
    "GoPlus decimal amount coefficient",
  );
  assertEqual(
    normalized.holders.totalSupply.decimals,
    4,
    "GoPlus decimal amount scale",
  );
  assertEqual(
    normalized.holders.holders[0]?.lockedDetails[0]?.endTimeMs,
    Date.parse("2023-08-02T12:00:00+04:00"),
    "GoPlus ISO lock expiry must preserve its timezone",
  );
  assertEqual(
    normalized.holders.holders[0]?.lockedDetails[1]?.endTimeMs,
    1_690_963_200_000,
    "GoPlus Unix-second lock expiry must normalize to milliseconds",
  );
  assert(
    normalized.holders.holders[0].lockedDetails[0].endTimeMs !== UNKNOWN &&
      normalized.holders.holders[0].lockedDetails[0].endTimeMs <
        Date.parse("2026-01-01T00:00:00Z"),
    "Historical GoPlus lock expiry must remain visibly expired",
  );
  assertEqual(
    normalized.liquidity.pools[0]?.address,
    UNIV4_POOL_ID,
    "UniV4 bytes32 pool ids must be preserved for liquidity provenance",
  );

  const malformedNumberPayload = goPlusPayload();
  malformedNumberPayload.result[TOKEN.toLowerCase()].holder_count = true as never;
  const malformed = normalizeGoPlusSecurityResponse(
    malformedNumberPayload,
    TOKEN,
  );

  assertEqual(
    malformed.holders.totalHolders,
    UNKNOWN,
    "Non-numeric provider values must remain unknown",
  );
  assertThrows(
    () => normalizeGoPlusSecurityResponse({ code: 0, result: {} }, TOKEN),
    "GoPlus non-success code must reject",
  );
  assertThrows(
    () =>
      normalizeGoPlusSecurityResponse(
        {
          code: 1,
          result: {
            [OTHER_TOKEN]: {},
          },
        },
        TOKEN,
      ),
    "GoPlus must require the requested result key",
  );
}

async function testHoneypotNormalization(): Promise<void> {
  const normalized = normalizeHoneypotCheckResponse(
    honeypotPayload(),
    TOKEN,
    1,
  );

  assertEqual(
    normalized.simulationResult.buyTaxPercent,
    0.29,
    "Honeypot taxes are already percent points",
  );
  assertEqual(
    normalized.summary.flags[0]?.code,
    "TRANSFER_BLOCKED",
    "Honeypot flag code must be preserved",
  );
  assertEqual(
    normalized.summary.flags[0]?.description,
    "Transfers can be restricted",
    "Honeypot flag description must be preserved",
  );
  assertEqual(
    normalized.summary.flags[0]?.severity,
    "high",
    "Honeypot flag severity must be preserved",
  );

  const withoutSummary = honeypotPayload();
  delete (withoutSummary as { summary?: unknown }).summary;
  const partial = normalizeHoneypotCheckResponse(withoutSummary, TOKEN, 1);

  assertEqual(
    partial.summary.risk,
    UNKNOWN,
    "Missing optional Honeypot summary must remain unknown",
  );
  assertEqual(
    partial.simulation.success,
    true,
    "Missing optional summary must not discard simulation data",
  );
  assertThrows(
    () =>
      normalizeHoneypotCheckResponse(
        {
          ...honeypotPayload(),
          token: {
            ...honeypotPayload().token,
            address: OTHER_TOKEN,
          },
        },
        TOKEN,
        1,
      ),
    "Honeypot token identity mismatch must reject",
  );
  assertThrows(
    () =>
      normalizeHoneypotCheckResponse(
        {
          ...honeypotPayload(),
          chain: { id: 56 },
        },
        TOKEN,
        1,
      ),
    "Honeypot chain identity mismatch must reject",
  );
}

async function testTopHoldersNormalization(): Promise<void> {
  const normalized = normalizeHoneypotTopHoldersResponse(
    topHoldersPayload(),
  );

  assert(
    normalized.totalSupply !== UNKNOWN,
    "TopHolders root totalSupply must be parsed",
  );
  assertEqual(
    normalized.totalSupply.units,
    1_000_000_000_000_000_000n,
    "TopHolders totalSupply must remain BigInt-safe",
  );
  assertEqual(
    normalized.totalSupply.decimals,
    UNKNOWN,
    "TopHolders raw amounts have unknown decimals until enriched",
  );
  assert(
    normalized.holders[0]?.balance !== UNKNOWN,
    "TopHolders balance must be parsed",
  );
  assertEqual(
    normalized.holders[0].balance.units,
    250_000_000_000_000_000n,
    "TopHolders holder balance must remain BigInt-safe",
  );
  assertEqual(
    normalizeHoneypotTopHoldersResponse({ totalSupply: "1" }).holders.length,
    0,
    "Missing optional holders array must not be treated as provider failure",
  );
}

async function testUnsupportedAndAddressValidation(): Promise<void> {
  let fetchCount = 0;
  const fetcher: TokenIntelligenceFetch = async () => {
    fetchCount += 1;

    return jsonResponse({});
  };
  const updates: string[] = [];
  const result = await loadTokenIntelligence({
    token: {
      chainId: 11155111,
      address: TOKEN,
      symbol: "WETH",
      name: "Wrapped Ether",
    },
    fetcher,
    onUpdate(update) {
      updates.push(update.intelligence.availability.overall);
    },
  });

  assertEqual(fetchCount, 0, "Unsupported Sepolia must not call providers");
  assertEqual(
    result.intelligence.availability.overall,
    "unsupported",
    "Sepolia must be explicit unsupported, not zero-valued",
  );
  assertEqual(updates.length, 1, "Unsupported state should publish immediately");

  let invalidRejected = false;

  try {
    await loadTokenIntelligence({
      token: {
        chainId: 1,
        address: "not-an-address",
        symbol: UNKNOWN,
        name: UNKNOWN,
      },
      fetcher,
    });
  } catch (error) {
    invalidRejected = error instanceof TypeError;
  }

  assert(invalidRejected, "Invalid addresses must reject before network I/O");
  assertEqual(fetchCount, 0, "Invalid addresses must not call providers");
}

type PendingFetch = {
  url: string;
  init: RequestInit | undefined;
  resolve: (response: Response) => void;
  reject: (error: unknown) => void;
};

async function waitFor(check: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (check()) {
      return;
    }

    await new Promise<void>((resolve) => setTimeout(resolve, 5));
  }

  throw new Error("Timed out waiting for provider settlement");
}

async function testConcurrencyAndIndependentFailure(): Promise<void> {
  clearGoPlusSecurityCache();
  clearHoneypotCaches();

  const pending: PendingFetch[] = [];
  const fetcher: TokenIntelligenceFetch = (url, init) =>
    new Promise<Response>((resolve, reject) => {
      pending.push({ url, init, resolve, reject });
    });
  const settled: (string | null)[] = [];
  const load = loadTokenIntelligence({
    token: {
      chainId: 1,
      address: TOKEN,
      symbol: "WETH",
      name: "Wrapped Ether",
    },
    fetcher,
    onUpdate(update) {
      settled.push(update.settledProvider);
    },
  });

  assertEqual(
    pending.length,
    3,
    "All three provider calls must start before any one settles",
  );

  const check = pending.find((request) => request.url.includes("IsHoneypot"));
  const goPlus = pending.find((request) => request.url.includes("gopluslabs"));
  const holders = pending.find((request) => request.url.includes("TopHolders"));

  assert(check && goPlus && holders, "Expected all provider endpoints");
  assertEqual(
    check.init?.headers,
    undefined,
    "Honeypot request must not add custom headers or trigger preflight",
  );

  check.resolve(jsonResponse(honeypotPayload()));
  await waitFor(() => settled.includes("honeypot-check"));
  goPlus.reject(new Error("network down"));
  holders.resolve(jsonResponse(topHoldersPayload()));

  const result = await load;

  assertEqual(
    settled[0],
    null,
    "The initial loading snapshot must be published",
  );
  assertEqual(
    settled.length,
    4,
    "A progressive snapshot must publish for every provider settlement",
  );
  assertEqual(
    result.providers.goplus.status,
    "unavailable",
    "One failed provider must be isolated",
  );
  assertEqual(
    result.providers.honeypotCheck.status,
    "available",
    "Successful trade provider must remain available",
  );
  assertEqual(
    result.providers.honeypotTopHolders.status,
    "available",
    "Successful holders provider must remain available",
  );
}

async function testCacheAndRefreshSemantics(): Promise<void> {
  clearGoPlusSecurityCache();
  clearHoneypotCaches();

  const calls: { url: string; headers: HeadersInit | undefined }[] = [];
  let currentTime = 1_000;
  const now = () => currentTime;
  const fetcher: TokenIntelligenceFetch = async (url, init) => {
    calls.push({ url, headers: init?.headers });

    return responseFor(url);
  };
  const options = {
    token: {
      chainId: 1,
      address: TOKEN,
      symbol: "WETH" as const,
      name: "Wrapped Ether" as const,
    },
    fetcher,
    now,
  };

  await loadTokenIntelligence(options);
  assertEqual(calls.length, 3, "First load must call all providers");

  await loadTokenIntelligence(options);
  assertEqual(calls.length, 3, "Warm cache must prevent render refetches");

  await loadTokenIntelligence({ ...options, refreshTrade: true });
  assertEqual(
    calls.length,
    5,
    "refreshTrade must bypass GoPlus/check but retain holder cache",
  );

  currentTime = 47_000;
  await loadTokenIntelligence(options);
  assertEqual(
    calls.length,
    7,
    "Trade endpoint caches must expire at the 45-second policy",
  );

  await loadTokenIntelligence({ ...options, forceRefresh: true });
  assertEqual(calls.length, 10, "forceRefresh must bypass every endpoint cache");

  const honeypotRequests = calls.filter(
    (call) =>
      call.url.includes("IsHoneypot") || call.url.includes("TopHolders"),
  );

  assert(
    honeypotRequests.every((call) => call.headers === undefined),
    "No Honeypot request may add custom headers",
  );
}

export async function runTokenIntelligenceAdapterSemanticTests(): Promise<void> {
  await testGoPlusNormalization();
  await testHoneypotNormalization();
  await testTopHoldersNormalization();
  await testUnsupportedAndAddressValidation();
  await testConcurrencyAndIndependentFailure();
  await testCacheAndRefreshSemantics();
}
