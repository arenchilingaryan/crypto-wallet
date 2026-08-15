import { parseAbiItem, type Address } from "viem";

import type {
  ApprovalDiscoveryChain,
} from "@/core/blockchain/scanApprovalGraph";
import type {
  ApprovalLogRecord,
  ScanRange,
} from "@/core/blockchain/approvalDiscovery";

import { ethereumPublicClient } from "./ethereumPublicClient";

// ERC-20 `Approval(owner, spender, value)`. Indexing owner lets the node return
// only this wallet's approvals across every token contract in one query, so we
// never have to know the token list up front. ERC-721's approval event shares
// this name but indexes its third argument, so it does not decode against this
// signature and is dropped here rather than being mistaken for an ERC-20
// permission; NFT approvals are out of this scan's scope either way.
const APPROVAL_EVENT = parseAbiItem(
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
);

export const approvalGraphChain: ApprovalDiscoveryChain = {
  async getLatestBlock(): Promise<bigint> {
    return ethereumPublicClient.getBlockNumber();
  },

  async getApprovalLogs(
    owner: Address,
    range: ScanRange,
  ): Promise<ApprovalLogRecord[]> {
    const logs = await ethereumPublicClient.getLogs({
      event: APPROVAL_EVENT,

      args: { owner },

      fromBlock: range.fromBlock,

      toBlock: range.toBlock,
    });

    const records: ApprovalLogRecord[] = [];

    for (const log of logs) {
      const token = log.address;

      const spender = log.args?.spender;

      if (!token || !spender) {
        continue;
      }

      records.push({ token, spender });
    }

    return records;
  },
};
