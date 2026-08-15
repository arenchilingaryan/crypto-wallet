import { createWatchlistStore } from "@/core/watchlist/watchlistStore";

import { keyValueStorage } from "./compositionRoot";

// The watchlist belongs to the person, not to the selected account, so it is
// built from the device storage alone — no wallet id anywhere in this wiring.
export const watchlistApi = createWatchlistStore({ storage: keyValueStorage });
