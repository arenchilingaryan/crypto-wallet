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
// never have to know the token list up front. (ERC-721's single-token approval
// shares this signature; such tokens surface as unreadable allowances, which
// the graph reports as uncertain rather than as fake ERC-20 permissions.)
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
