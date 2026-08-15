import { useCallback, useEffect, useRef, useState } from "react";

import { useFocusEffect, useRouter } from "expo-router";

import type { Address } from "viem";

import {
  WatchlistView,
} from "@/components/watchlist/watchlist-view";
import type { WatchlistRowData } from "@/components/watchlist/watchlist-row";

import { ACTIVE_NETWORK } from "@/constants/networks";

import { getPortfolio } from "@/core/blockchain/getPortfolio";
import { assetRouteParams } from "@/core/navigation/assetRoute";
import { getTokenMetadata } from "@/core/blockchain/getTokenMetadata";
import {
  UNKNOWN,
  type TokenIntelligence,
} from "@/core/token-intelligence/types";
import { buildWatchRowObservation } from "@/core/watchlist/observation";
import { runBounded } from "@/core/watchlist/refreshQueue";
import {
  canEnrichOnNetwork,
  searchWatchlist,
  sortWatchlist,
  watchKey,
} from "@/core/watchlist/watchlist";
import type { WatchedToken } from "@/core/watchlist/types";

import { loadTokenIntelligence } from "@/platform/react-native/token-intelligence";
import { walletApi } from "@/platform/react-native/walletApi";
import { watchlistApi } from "@/platform/react-native/watchlistApi";

type RowState = {
  symbol: string | null;

  name: string | null;

  logo: string | null;

  priceUsd: number | null;

  intelligence: TokenIntelligence | null;

  refreshing: boolean;

  // The entry names a network this build does not run on.
  offNetwork: boolean;
};

// Only a safety net for the Refresh button. It is set well past a legitimate
// full-list refresh (fifty tokens, four at a time, each with its own provider
// deadline) so a slow list is never mistaken for a stuck one.
const REFRESH_WATCHDOG_MS = 180_000;

const EMPTY_ROW: RowState = {
  symbol: null,
  name: null,
  logo: null,
  priceUsd: null,
  intelligence: null,
  refreshing: false,
  offNetwork: false,
};

export default function WatchlistScreen() {
  const router = useRouter();

  const [items, setItems] = useState<WatchedToken[] | null>(null);

  const [unreadable, setUnreadable] = useState<string | null>(null);

  const [actionError, setActionError] = useState<string | null>(null);

  const [repaired, setRepaired] = useState(false);

  const [rowStates, setRowStates] = useState<Record<string, RowState>>({});

  const [refreshing, setRefreshing] = useState(false);

  const [query, setQuery] = useState("");

  const [now, setNow] = useState(() => Date.now());

  // A second tap while a fan-out is already running must not start another one.
  const refreshInFlight = useRef(false);

  // If the watchdog ever releases the lock while a wave is still running, a
  // newer wave can start. The generation stamps each wave so a straggler from
  // the old one cannot overwrite fresher data or flip the button back.
  const waveGeneration = useRef(0);

  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
    };
  }, []);

  const patchRow = useCallback((key: string, patch: Partial<RowState>) => {
    if (!mounted.current) {
      return;
    }

    setRowStates((current) => ({
      ...current,

      [key]: { ...(current[key] ?? EMPTY_ROW), ...patch },
    }));
  }, []);

  // Membership first, on its own. Rows render from this alone, so a slow or
  // broken provider can never stop the list from appearing.
  const loadMembership = useCallback(async () => {
    const snapshot = await watchlistApi.load();

    if (!mounted.current) {
      return null;
    }

    if (snapshot.status === "unreadable") {
      setUnreadable(snapshot.reason);

      setItems(null);

      return null;
    }

    const sorted = sortWatchlist(snapshot.items);

    setUnreadable(null);

    // A fresh read supersedes whatever a previous action failed to do; keeping
    // the old complaint on screen would describe a state that no longer exists.
    setActionError(null);

    setRepaired(snapshot.repaired);

    setItems(sorted);

    return sorted;
  }, []);

  const refreshRows = useCallback(
    async (tokens: WatchedToken[], forceRefresh: boolean) => {
      if (refreshInFlight.current || tokens.length === 0) {
        return;
      }

      refreshInFlight.current = true;

      waveGeneration.current += 1;

      const generation = waveGeneration.current;

      const isCurrentWave = () => waveGeneration.current === generation;

      setRefreshing(true);

      // A provider that never answers must not wedge the screen. The watchdog
      // releases the UI lock only — it deliberately does NOT abort the work.
      // Provider requests already carry their own deadline, and the fetches run
      // through a cache shared with Token Details: cancelling them here would
      // cancel that screen's request too, making this screen's timeout somebody
      // else's failure. Whatever eventually settles still lands in the cache.
      const watchdog = setTimeout(() => {
        if (!isCurrentWave()) {
          return;
        }

        refreshInFlight.current = false;

        if (mounted.current) {
          setRefreshing(false);
        }
      }, REFRESH_WATCHDOG_MS);

      // Prices come from the portfolio, which only knows tokens this wallet
      // holds. A watched token with no balance therefore has no price here —
      // it is reported as unavailable rather than invented as zero.
      const prices = new Map<string, { priceUsd: number | null; symbol: string; name: string; logo: string | null }>();

      try {
        const wallet = await walletApi.load();

        if (wallet) {
          const portfolio = await getPortfolio(wallet.address);

          for (const asset of portfolio.assets) {
            if (asset.type === "erc20" && asset.contractAddress) {
              prices.set(asset.contractAddress.toLowerCase(), {
                priceUsd: asset.priceUsd,
                symbol: asset.symbol,
                name: asset.name,
                logo: asset.logo,
              });
            }
          }
        }
      } catch (portfolioError) {
        console.error("Watchlist portfolio lookup failed:", portfolioError);
      }

      try {
        await runBounded({
          items: tokens,

          worker: async (token) => {
            const key = watchKey(token);

            // Anything this wave writes is discarded once it has been
            // superseded, so old results never land on top of newer ones.
            const patch = (value: Partial<RowState>) => {
              if (isCurrentWave()) {
                patchRow(key, value);
              }
            };

            // An entry saved for another network cannot be enriched here: the
            // balances, metadata and provider coverage all belong to the active
            // one. Asking anyway would show a foreign network's verdict on this
            // row. The entry is kept — it is the user's — and simply says where
            // it belongs.
            if (!canEnrichOnNetwork(token, ACTIVE_NETWORK.chain.id)) {
              patch({ offNetwork: true, refreshing: false });

              return;
            }

            patch({ refreshing: true });

            const held = prices.get(token.address.toLowerCase());

            if (held) {
              patch({
                symbol: held.symbol,
                name: held.name,
                logo: held.logo,
                priceUsd: held.priceUsd,
              });
            } else {
              try {
                const metadata = await getTokenMetadata(token.address);

                if (metadata) {
                  patch({
                    symbol: metadata.symbol,
                    name: metadata.name,
                    logo: metadata.logo,
                  });
                }
              } catch (metadataError) {
                // Metadata is display only. Losing it must never remove the
                // token from the watchlist.
                console.error("Watchlist metadata failed:", metadataError);
              }
            }

            try {
              const known = held ?? null;

              const update = await loadTokenIntelligence({
                token: {
                  chainId: token.chainId,

                  address: token.address,

                  // The intelligence layer already models "we do not know the
                  // name" — pass that rather than inventing a placeholder.
                  symbol: known?.symbol ?? UNKNOWN,

                  name: known?.name ?? UNKNOWN,
                },

                forceRefresh,
              });

              patch({ intelligence: update.intelligence });
            } finally {
              patch({ refreshing: false });
            }
          },

          onSettled: (token, _index, error) => {
            if (error && isCurrentWave()) {
              console.error("Watchlist refresh failed:", error);

              patchRow(watchKey(token), { refreshing: false });
            }
          },
        });
      } finally {
        clearTimeout(watchdog);

        // A straggler from a superseded wave must not report that the current
        // one has finished.
        if (isCurrentWave()) {
          refreshInFlight.current = false;

          if (mounted.current) {
            setRefreshing(false);

            setNow(Date.now());
          }
        }
      }
    },
    [patchRow],
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;

      void (async () => {
        const tokens = await loadMembership();

        if (active && tokens) {
          setNow(Date.now());

          await refreshRows(tokens, false);
        }
      })();

      // "Checked 2m ago" has to keep counting while the user reads the screen,
      // otherwise a stale row goes on claiming it was just checked.
      const tick = setInterval(() => {
        if (active) {
          setNow(Date.now());
        }
      }, 30_000);

      return () => {
        active = false;

        clearInterval(tick);
      };
    }, [loadMembership, refreshRows]),
  );

  const describe = useCallback(
    (id: { chainId: number; address: Address }) => {
      const state = rowStates[watchKey(id)];

      return {
        symbol: state?.symbol ?? undefined,
        name: state?.name ?? undefined,
      };
    },
    [rowStates],
  );

  const rows: WatchlistRowData[] | null =
    items === null
      ? null
      : searchWatchlist(items, query, describe).map((token) => {
          const state = rowStates[watchKey(token)] ?? EMPTY_ROW;

          return {
            token,

            symbol: state.symbol,

            name: state.name,

            logo: state.logo,

            offNetwork: state.offNetwork,

            observation: buildWatchRowObservation({
              intelligence: state.intelligence,

              refreshing: state.refreshing,

              priceUsd: state.priceUsd,
            }),
          };
        });

  return (
    <WatchlistView
      rows={rows}
      unreadable={unreadable}
      actionError={actionError}
      repaired={repaired}
      refreshing={refreshing}
      query={query}
      now={now}
      onChangeQuery={setQuery}
      onRefresh={() => {
        if (items) {
          void refreshRows(items, true);
        }
      }}
      onRetry={() => {
        setItems(null);

        setUnreadable(null);

        void (async () => {
          const tokens = await loadMembership();

          if (tokens) {
            await refreshRows(tokens, false);
          }
        })();
      }}
      onRemove={(row) => {
        void (async () => {
          const result = await watchlistApi.remove(row.token);

          if (!mounted.current) {
            return;
          }

          if (!result.ok) {
            // Report the failed action beside the list. The list itself was
            // read fine, so hiding it behind a "could not be loaded" screen
            // would punish every row for one failed tap.
            setActionError(result.message);

            return;
          }

          setActionError(null);

          setItems(sortWatchlist(result.items));
        })();
      }}
      onOpen={(row) => {
        // Navigation identity is (chainId, address) — the same pair the domain
        // uses. Never the symbol, and never the address alone.
        router.push({
          pathname: "/asset/[id]",
          params: {
            ...assetRouteParams(row.token),
            origin: "watchlist",
          },
        });
      }}
      onExplore={() => {
        router.push("/search");
      }}
      onBack={() => {
        router.back();
      }}
    />
  );
}
