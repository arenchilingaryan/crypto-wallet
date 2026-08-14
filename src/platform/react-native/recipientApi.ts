import type { Address } from "viem";

import { getProvenRecipients } from "@/core/blockchain/getActivity";
import {
  analyzeRecipient,
  type HistoryCoverage,
  type RecipientIntelligence,
} from "@/core/security/recipientIntelligence";

import { walletEngine } from "./compositionRoot";
import { trackedTransactionApi } from "./trackedTransactionApi";

export const recipientApi = {
  // Assemble the proven-send reference set from two sources — the chain's
  // native-send history and this device's confirmed tracked transactions — and
  // hand it to the pure analyzer. Tracked sends are local and reliable, so they
  // count even when the chain history cannot be read; only the chain read's
  // failure downgrades coverage to "unavailable".
  async analyze(recipient: Address): Promise<RecipientIntelligence> {
    const wallet = await walletEngine.getActive();

    if (!wallet) {
      throw new Error("Active wallet not found");
    }

    const ownerLower = wallet.address.toLowerCase();

    const proven = new Set<string>();

    const tracked = await trackedTransactionApi
      .listAllForDevice()
      .catch((trackedError) => {
        console.error("Tracked history lookup failed:", trackedError);

        return [];
      });

    for (const item of tracked) {
      if (item.status !== "confirmed") {
        continue;
      }

      // Only actual transfers name a chosen recipient. An approve's `to` is the
      // token contract and a swap's `to` is the router — infrastructure, not a
      // recipient the user picked — so they must not enter the reference set.
      if (item.assetType !== "native" && item.assetType !== "erc20") {
        continue;
      }

      if (item.from.toLowerCase() !== ownerLower) {
        continue;
      }

      if (item.to.toLowerCase() === ownerLower) {
        continue;
      }

      proven.add(item.to.toLowerCase());
    }

    let coverage: HistoryCoverage = "unavailable";

    try {
      const recipients = await getProvenRecipients(wallet.address);

      for (const address of recipients) {
        proven.add(address.toLowerCase());
      }

      // Native sends plus this device's tracked history are only part of the
      // picture: chain ERC-20 sends are excluded (intent unprovable) and an
      // imported seed may have sent from elsewhere. So a successful read proves
      // an address IS familiar but never that it was NEVER used — coverage is
      // capped at "partial", never "complete", so identity tops out at
      // "not-seen" rather than a global "first-time".
      coverage = "partial";
    } catch (error) {
      console.error("Recipient history lookup failed:", error);

      coverage = "unavailable";
    }

    return analyzeRecipient({
      recipient,

      ownAddress: wallet.address,

      provenRecipients: [...proven] as Address[],

      historyCoverage: coverage,
    });
  },
};
