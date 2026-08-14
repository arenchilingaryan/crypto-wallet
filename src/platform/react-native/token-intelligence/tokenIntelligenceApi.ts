import { buildTokenIntelligence } from "@/core/token-intelligence/buildTokenIntelligence";
import type {
  BuildTokenIntelligenceInput,
  NormalizedGoPlusSnapshot,
  NormalizedHoneypotSnapshot,
  NormalizedHoneypotTopHoldersSnapshot,
  ProviderId,
  ProviderSnapshot,
  TokenIdentity,
  TokenIntelligence,
} from "@/core/token-intelligence/types";

import { normalizeTokenAddress } from "./address";
import type { TokenIntelligenceFetch } from "./http";
import { providerFailureReason } from "./errors";
import { getGoPlusSecurity } from "./goplusApi";
import {
  getHoneypotCheck,
  getHoneypotTopHolders,
} from "./honeypotApi";
import {
  isTokenIntelligenceProviderSupported,
  unsupportedProviderReason,
} from "./support";

export type TokenIntelligenceProviderBundle =
  BuildTokenIntelligenceInput["providers"];

export type TokenIntelligenceUpdate = {
  intelligence: TokenIntelligence;
  providers: TokenIntelligenceProviderBundle;
  settledProvider: ProviderId | null;
  pendingProviders: readonly ProviderId[];
};

export type LoadTokenIntelligenceOptions = {
  token: TokenIdentity;
  forceRefresh?: boolean;
  refreshTrade?: boolean;
  fetcher?: TokenIntelligenceFetch;
  signal?: AbortSignal;
  now?: () => number;
  onUpdate?: (update: TokenIntelligenceUpdate) => void;
};

export function createUnavailableTokenIntelligence(
  token: TokenIdentity,
  reason: string,
  now = Date.now(),
): TokenIntelligence {
  const unavailable = {
    status: "unavailable" as const,
    attemptedAt: now,
    reason,
  };

  return buildTokenIntelligence({
    token,
    providers: {
      goplus: unavailable,
      honeypotCheck: unavailable,
      honeypotTopHolders: unavailable,
    },
    now,
  });
}

type ProviderSettlement =
  | {
      provider: "goplus";
      snapshot: ProviderSnapshot<NormalizedGoPlusSnapshot>;
    }
  | {
      provider: "honeypot-check";
      snapshot: ProviderSnapshot<NormalizedHoneypotSnapshot>;
    }
  | {
      provider: "honeypot-top-holders";
      snapshot: ProviderSnapshot<NormalizedHoneypotTopHoldersSnapshot>;
    };

function initialSnapshot<T>(
  provider: ProviderId,
  chainId: number,
  requestedAt: number,
): ProviderSnapshot<T> {
  return isTokenIntelligenceProviderSupported(chainId, provider)
    ? {
        status: "loading",
        requestedAt,
      }
    : {
        status: "unsupported",
        reason: unsupportedProviderReason(chainId),
      };
}

function unavailableSnapshot<T>(
  attemptedAt: number,
  error: unknown,
  fallback: string,
): ProviderSnapshot<T> {
  return {
    status: "unavailable",
    attemptedAt,
    reason: providerFailureReason(error, fallback),
  };
}

function applySettlement(
  providers: TokenIntelligenceProviderBundle,
  settlement: ProviderSettlement,
): TokenIntelligenceProviderBundle {
  switch (settlement.provider) {
    case "goplus":
      return {
        ...providers,
        goplus: settlement.snapshot,
      };
    case "honeypot-check":
      return {
        ...providers,
        honeypotCheck: settlement.snapshot,
      };
    case "honeypot-top-holders":
      return {
        ...providers,
        honeypotTopHolders: settlement.snapshot,
      };
  }
}

function pendingProviders(
  providers: TokenIntelligenceProviderBundle,
): readonly ProviderId[] {
  const pending: ProviderId[] = [];

  if (providers.goplus.status === "loading") {
    pending.push("goplus");
  }

  if (providers.honeypotCheck.status === "loading") {
    pending.push("honeypot-check");
  }

  if (providers.honeypotTopHolders.status === "loading") {
    pending.push("honeypot-top-holders");
  }

  return pending;
}

function buildUpdate({
  token,
  providers,
  settledProvider,
  now,
}: {
  token: TokenIdentity;
  providers: TokenIntelligenceProviderBundle;
  settledProvider: ProviderId | null;
  now: number;
}): TokenIntelligenceUpdate {
  return {
    intelligence: buildTokenIntelligence({
      token,
      providers,
      now,
    }),
    providers,
    settledProvider,
    pendingProviders: pendingProviders(providers),
  };
}

/**
 * Loads all supported providers concurrently. The callback first receives the
 * loading/unsupported state, then a rebuilt domain snapshot after every
 * provider settles. Provider failures are isolated and represented as
 * unavailable snapshots.
 */
export async function loadTokenIntelligence({
  token: inputToken,
  forceRefresh = false,
  refreshTrade = false,
  fetcher,
  signal,
  now = Date.now,
  onUpdate,
}: LoadTokenIntelligenceOptions): Promise<TokenIntelligenceUpdate> {
  const address = normalizeTokenAddress(inputToken.address);
  const token: TokenIdentity = {
    ...inputToken,
    address,
  };
  const requestedAt = now();
  let providers: TokenIntelligenceProviderBundle = {
    goplus: initialSnapshot("goplus", token.chainId, requestedAt),
    honeypotCheck: initialSnapshot(
      "honeypot-check",
      token.chainId,
      requestedAt,
    ),
    honeypotTopHolders: initialSnapshot(
      "honeypot-top-holders",
      token.chainId,
      requestedAt,
    ),
  };
  const tasks: Promise<ProviderSettlement>[] = [];
  const tradeForceRefresh = forceRefresh || refreshTrade;

  if (isTokenIntelligenceProviderSupported(token.chainId, "goplus")) {
    tasks.push(
      getGoPlusSecurity({
        chainId: token.chainId,
        tokenAddress: address,
        forceRefresh: tradeForceRefresh,
        fetcher,
        signal,
        now,
      }).then<ProviderSettlement, ProviderSettlement>(
        ({ value }) => ({
          provider: "goplus",
          snapshot: value,
        }),
        (error) => ({
          provider: "goplus",
          snapshot: unavailableSnapshot(
            now(),
            error,
            "GoPlus security data is unavailable",
          ),
        }),
      ),
    );
  }

  if (
    isTokenIntelligenceProviderSupported(token.chainId, "honeypot-check")
  ) {
    tasks.push(
      getHoneypotCheck({
        chainId: token.chainId,
        tokenAddress: address,
        forceRefresh: tradeForceRefresh,
        fetcher,
        signal,
        now,
      }).then<ProviderSettlement, ProviderSettlement>(
        ({ value }) => ({
          provider: "honeypot-check",
          snapshot: value,
        }),
        (error) => ({
          provider: "honeypot-check",
          snapshot: unavailableSnapshot(
            now(),
            error,
            "Honeypot.is trade simulation is unavailable",
          ),
        }),
      ),
    );
  }

  if (
    isTokenIntelligenceProviderSupported(
      token.chainId,
      "honeypot-top-holders",
    )
  ) {
    tasks.push(
      getHoneypotTopHolders({
        chainId: token.chainId,
        tokenAddress: address,
        forceRefresh,
        fetcher,
        signal,
        now,
      }).then<ProviderSettlement, ProviderSettlement>(
        ({ value }) => ({
          provider: "honeypot-top-holders",
          snapshot: value,
        }),
        (error) => ({
          provider: "honeypot-top-holders",
          snapshot: unavailableSnapshot(
            now(),
            error,
            "Honeypot.is holder distribution is unavailable",
          ),
        }),
      ),
    );
  }

  onUpdate?.(
    buildUpdate({
      token,
      providers,
      settledProvider: null,
      now: now(),
    }),
  );

  const progressiveTasks = tasks.map(async (task) => {
    const settlement = await task;

    providers = applySettlement(providers, settlement);
    onUpdate?.(
      buildUpdate({
        token,
        providers,
        settledProvider: settlement.provider,
        now: now(),
      }),
    );

    return settlement;
  });

  const settlements = await Promise.allSettled(progressiveTasks);

  // Reconcile from the settled values so the final result does not depend on
  // callback timing or completion order.
  for (const settlement of settlements) {
    if (settlement.status === "fulfilled") {
      providers = applySettlement(providers, settlement.value);
    }
  }

  return buildUpdate({
    token,
    providers,
    settledProvider: null,
    now: now(),
  });
}
