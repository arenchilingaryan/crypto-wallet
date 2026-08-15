/* global __dirname */

// VS-C06 regression.
//
// Before the fix, `policyApi.check` and `transactionApi.prepareNativeTransfer`
// each asked "which wallet is active right now?" independently. A switch
// landing between the two produced a transaction from wallet B carrying
// wallet A's security review — including A's recipient history, which is
// exactly what the new-recipient limit exists to catch.
//
// The review now names the wallet it is about, preparation demands that name
// back, and a mismatch (or a missing name) is refused.

const assert = require("node:assert/strict");
const path = require("node:path");
const Module = require("node:module");

require("sucrase/register/ts");

const sourceRoot = path.join(__dirname, "..", "..", "src");
const resolveFilename = Module._resolveFilename;

Module._resolveFilename = function patchedResolve(request, ...rest) {
  const mapped = request.startsWith("@/")
    ? path.join(sourceRoot, request.slice(2))
    : request;

  return resolveFilename.call(this, mapped, ...rest);
};

function stub(relativePath, exports) {
  const filename = require.resolve(path.join(sourceRoot, relativePath));

  require.cache[filename] = {
    id: filename,
    filename,
    loaded: true,
    exports,
    children: [],
    paths: [],
  };
}

const walletA = {
  id: "0x1111111111111111111111111111111111111111",
  name: "Wallet A",
  address: "0x1111111111111111111111111111111111111111",
};
const walletB = {
  id: "0x2222222222222222222222222222222222222222",
  name: "Wallet B",
  address: "0x2222222222222222222222222222222222222222",
};
const recipient = "0x3333333333333333333333333333333333333333";
let activeWallet = walletA;

const policy = JSON.stringify({
  version: 1,
  maxSingleTransferUsd: null,
  newRecipientMaxUsd: 500,
  dailyOutflowLimitUsd: null,
  maxApprovalExposureUsd: null,
  blockUnlimitedApprovals: true,
  blockUnknownSpenders: true,
  maxSwapLossUsd: null,
});

stub("constants/networks.ts", {
  ACTIVE_NETWORK: {
    id: "eth-mainnet",
    name: "Ethereum",
    nativeSymbol: "ETH",
    chain: { id: 1 },
    isTestnet: false,
    tokenSearchNetwork: "eth",
  },
  isTestnetNetwork: () => false,
});

stub("platform/react-native/compositionRoot.ts", {
  keyValueStorage: {
    async get() {
      return policy;
    },
    async set() {},
    async remove() {},
  },
  walletEngine: {
    async getActive() {
      return activeWallet;
    },
  },
});

stub("core/blockchain/getActivity.ts", {
  async getActivity() {
    return [];
  },
});

stub("core/blockchain/getPortfolio.ts", {
  async getPortfolio() {
    return {
      assets: [
        {
          symbol: "ETH",
          priceUsd: 1_000,
        },
      ],
    };
  },
});

stub("platform/react-native/trackedTransactionApi.ts", {
  trackedTransactionApi: {
    async listAllForDevice() {
      return [
        {
          version: 1,
          hash: `0x${"a".repeat(64)}`,
          chainId: 1,
          walletId: walletA.id,
          from: walletA.address,
          to: recipient,
          assetType: "native",
          symbol: "ETH",
          valueWei: "1",
          valueUsd: 1,
          createdAt: Date.now(),
          status: "confirmed",
          blockNumber: "1",
          gasUsed: "21000",
          effectiveGasPriceWei: "1",
          confirmedAt: Date.now(),
        },
      ];
    },
  },
});

stub("platform/react-native/ethereumPublicClient.ts", {
  ethereumPublicClient: {
    async getCode() {
      return "0x";
    },
    async getChainId() {
      return 1;
    },
    async getBalance() {
      return 10n ** 20n;
    },
    async getTransactionCount() {
      return 0;
    },
    async estimateGas() {
      return 21_000n;
    },
    async estimateFeesPerGas() {
      return {
        maxFeePerGas: 10_000_000_000n,
        maxPriorityFeePerGas: 1_000_000_000n,
      };
    },
  },
});

stub("platform/react-native/approvalGraphChain.ts", {
  approvalGraphChain: {},
});

const failures = [];

function record(ok, message) {
  console.log(`${ok ? "ok  " : "FAIL"} ${message}`);

  if (!ok) {
    failures.push(message);
  }
}

async function rejection(promise) {
  try {
    await promise;

    return null;
  } catch (error) {
    return error;
  }
}

async function main() {
  const { policyApi } = require(path.join(
    sourceRoot,
    "platform/react-native/policyApi.ts",
  ));
  const { transactionApi } = require(path.join(
    sourceRoot,
    "platform/react-native/transactionApi.ts",
  ));
  const { WalletIdentityChangedError } = require(path.join(
    sourceRoot,
    "core/wallet/walletIdentity.ts",
  ));

  // 1. Wallet A is active, has sent to this recipient before, and is allowed.
  const reviewForA = await policyApi.check({
    recipient,
    symbol: "ETH",
    amount: "1",
  });

  const aHistoryPassed = reviewForA.review.checks.some(
    (check) =>
      check.id === "recipient-history" &&
      check.status === "pass" &&
      check.title === "You have sent to this address before",
  );

  assert.equal(reviewForA.review.decision.decision, "allow");
  assert.equal(aHistoryPassed, true);

  record(
    reviewForA.wallet?.address?.toLowerCase() === walletA.address.toLowerCase(),
    `the review names the wallet it was made for — reviewWallet=${reviewForA.wallet?.address}`,
  );

  // 2. The active wallet changes underneath the flow.
  activeWallet = walletB;

  // 3. The same review can no longer be turned into a transaction.
  const boundError = await rejection(
    transactionApi.prepareNativeTransfer({
      to: recipient,
      value: 10n ** 18n,
      expectedWallet: reviewForA.wallet,
    }),
  );

  record(
    boundError instanceof WalletIdentityChangedError,
    `preparing wallet A's review after a switch to B is refused — ${
      boundError ? boundError.name : "it was prepared anyway"
    }`,
  );

  // 4. There is no unbound path around the guard.
  const unboundError = await rejection(
    transactionApi.prepareNativeTransfer({
      to: recipient,
      value: 10n ** 18n,
    }),
  );

  record(
    unboundError instanceof WalletIdentityChangedError,
    `preparing without a reviewed wallet is refused — ${
      unboundError ? unboundError.name : "it was prepared anyway"
    }`,
  );

  // 5. The refusal is not academic: B's own review of the same request blocks.
  const reviewForB = await policyApi.check({
    recipient,
    symbol: "ETH",
    amount: "1",
  });

  record(
    reviewForB.review.decision.decision === "block" &&
      reviewForB.review.decision.reason === "over-new-recipient",
    `wallet B's own review of the same transfer blocks — ${reviewForB.review.decision.decision}/${reviewForB.review.decision.reason}`,
  );

  // 6. The guard refuses a switch, it does not break the ordinary path.
  const allowedForB = await policyApi.check({
    recipient,
    symbol: "ETH",
    amount: "0.1",
  });

  assert.equal(allowedForB.review.decision.decision, "allow");

  const preparedForB = await transactionApi.prepareNativeTransfer({
    to: recipient,
    value: 10n ** 17n,
    expectedWallet: allowedForB.wallet,
  });

  record(
    preparedForB.from.toLowerCase() === walletB.address.toLowerCase(),
    `a review and a preparation on the same wallet still work — preparedWallet=${preparedForB.from}`,
  );

  console.log(
    `\n${failures.length} security regression(s) reproduced`,
  );

  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
