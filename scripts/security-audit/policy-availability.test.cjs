/* global __dirname */

// FLR-001 follow-ups. The first fix only caught a policy that decrypted into
// unreadable JSON. The likelier device failure is a secure entry that answers
// `null` — indistinguishable from "never configured" unless something outside
// that store remembers a policy was written.
//
// Also pins the two places where the refusal has to hold: the last gate before
// signing is authorized (which approvals and swaps reach without any outflow
// hold), and the wording shown when the missing input is local, not the network.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const { test } = require("node:test");

require("sucrase/register/ts");

const REPOSITORY_ROOT = path.join(__dirname, "..", "..");
const SRC = path.join(REPOSITORY_ROOT, "src");

const originalResolveFilename = Module._resolveFilename;
const originalLoad = Module._load;

Module._resolveFilename = function resolveAlias(request, ...rest) {
  const mapped = request.startsWith("@/")
    ? path.join(SRC, request.slice(2))
    : request;

  return originalResolveFilename.call(this, mapped, ...rest);
};

const secure = new Map();
let secureReadFails = false;

const deviceStorage = new Map();

const asyncStorageFake = {
  getItem: async (key) => deviceStorage.get(key) ?? null,
  setItem: async (key, value) => {
    deviceStorage.set(key, value);
  },
};

function stub(relativePath, exports) {
  const filename = require.resolve(path.join(SRC, relativePath));

  require.cache[filename] = {
    id: filename,
    filename,
    loaded: true,
    exports,
    children: [],
    paths: [],
  };
}

Module._load = function loadFakes(request, parent, isMain) {
  if (request === "@react-native-async-storage/async-storage") {
    return asyncStorageFake;
  }

  if (request === "expo-crypto") {
    return {
      CryptoDigestAlgorithm: { SHA256: "SHA-256" },
      digestStringAsync: async () => "audit-digest",
    };
  }

  return originalLoad.call(this, request, parent, isMain);
};

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
    async get(key) {
      if (secureReadFails) {
        throw new Error("keystore unavailable");
      }

      return secure.get(key) ?? null;
    },
    async set(key, value) {
      secure.set(key, value);
    },
    async remove(key) {
      secure.delete(key);
    },
  },
  walletEngine: {
    async getActive() {
      return {
        id: "0x1111111111111111111111111111111111111111",
        name: "Wallet A",
        address: "0x1111111111111111111111111111111111111111",
      };
    },
  },
});

stub("core/blockchain/getActivity.ts", { async getActivity() { return []; } });

stub("core/blockchain/getPortfolio.ts", {
  async getPortfolio() {
    return { assets: [{ symbol: "ETH", priceUsd: 1_000 }] };
  },
});

const { TrackedTransactionStateError } = require(
  path.join(SRC, "core", "transactions", "trackedTransactionState.ts"),
);

stub("platform/react-native/trackedTransactionApi.ts", {
  trackedTransactionApi: {
    async listAllForDevice() {
      throw new TrackedTransactionStateError();
    },
  },
});

stub("platform/react-native/ethereumPublicClient.ts", {
  ethereumPublicClient: {
    async getCode() {
      return "0x";
    },
  },
});

// Everything securityApi touches that needs a device. The PIN itself is not
// what is under test here; the gate that runs after it is.
stub("platform/react-native/keyValueStorage.ts", {
  expoKeyValueStorage: {
    async get(key) {
      return secure.get(key) ?? null;
    },
    async set(key, value) {
      secure.set(key, value);
    },
    async remove(key) {
      secure.delete(key);
    },
  },
});

stub("platform/react-native/expoRandomSource.ts", {
  expoRandomSource: {
    async getBytes(length) {
      return new Uint8Array(length);
    },
  },
});

stub("platform/react-native/vaultKeeper.ts", {
  async adoptPin() {},
  async sealEveryWallet() {},
  async stageNewPin() {
    return "audit-salt";
  },
});

stub("platform/react-native/unlockMaterial.ts", {
  clearUnlockMaterial() {},
  getUnlockMaterial() {
    return null;
  },
  setUnlockMaterial() {},
});

stub("platform/react-native/pendingSecrets.ts", {
  clearAllPendingSecrets() {},
  clearPendingSecret() {},
  peekPendingSecret() {
    return null;
  },
  pendingSecretEntries() {
    return [];
  },
  stagePendingSecret() {},
});

stub("platform/react-native/outflowGuardApi.ts", {
  outflowGuardApi: {
    async hold() {
      return { ok: true, id: null };
    },
    async release() {},
    async reconcile() {
      return [];
    },
    async readable() {
      return true;
    },
    async quarantine() {},
  },
});

stub("core/security/pin.ts", {
  async verifyPin() {
    return { ok: true };
  },
  async createPin() {},
  async hasPin() {
    return true;
  },
  describePinFailure() {
    return "";
  },
});

const { policyApi } = require(
  path.join(SRC, "platform", "react-native", "policyApi.ts"),
);

const CONFIGURED = JSON.stringify({
  version: 1,
  maxSingleTransferUsd: 500,
  newRecipientMaxUsd: null,
  dailyOutflowLimitUsd: null,
  maxApprovalExposureUsd: null,
  blockUnlimitedApprovals: true,
  blockUnknownSpenders: true,
  maxSwapLossUsd: null,
});

function reset() {
  secure.clear();
  deviceStorage.clear();
  secureReadFails = false;
}

test("a policy that was never saved stays the permissive default", async () => {
  reset();

  const policy = await policyApi.load();

  assert.equal(policy.availability, "configured");
});

test("saving a policy leaves a marker outside the secure store", async () => {
  reset();

  await policyApi.save(JSON.parse(CONFIGURED));

  assert.notEqual(
    deviceStorage.get("security.policy.configured.v1"),
    undefined,
    "nothing outside the secure store remembers that a policy exists",
  );
});

test("a secure entry that reads empty after a policy was saved is unavailable", async () => {
  reset();

  await policyApi.save(JSON.parse(CONFIGURED));

  // Exactly what SecureStore answers when an entry can no longer be decrypted.
  secure.delete("security.policy.v1");

  const policy = await policyApi.load();

  assert.equal(
    policy.availability,
    "unavailable",
    "a lost policy was reported as a deliberate choice to run without limits",
  );
});

test("limits saved before the marker existed are still protected", async () => {
  reset();

  // An existing install: the policy is already in the secure store, and the
  // marker did not exist when it was written. Without a backfill this user
  // keeps the original defect until they happen to re-save their limits.
  secure.set("security.policy.v1", CONFIGURED);

  const first = await policyApi.load();

  assert.equal(first.availability, "configured");

  secure.delete("security.policy.v1");

  const afterLoss = await policyApi.load();

  assert.equal(
    afterLoss.availability,
    "unavailable",
    "a policy that existed before this build was lost silently and read as no limits",
  );
});

test("a read that fails outright is unavailable, not permissive", async () => {
  reset();

  secureReadFails = true;

  const policy = await policyApi.load();

  assert.equal(policy.availability, "unavailable");
});

test("a corrupt local record is not reported as a network problem", async () => {
  reset();

  await policyApi.save(JSON.parse(CONFIGURED));

  const { review } = await policyApi.check({
    recipient: "0x3333333333333333333333333333333333333333",
    symbol: "ETH",
    amount: "1",
  });

  assert.equal(review.decision.decision, "block");
  assert.match(
    review.decision.message,
    /this device's own record/i,
    `local corruption was described as: ${review.decision.message}`,
  );
});

// The gate is exercised for real: an approval carries no outflow hold, so a
// gate nested inside the `outflow` branch would authorize it. A source-text
// assertion here would pass on a one-word restatement of the same bug.

function approval(kind) {
  return {
    kind,
    type: "eip1559",
    chainId: 1,
    from: "0x1111111111111111111111111111111111111111",
    to: "0x4444444444444444444444444444444444444444",
    value: 0n,
    nonce: 0,
    gas: 50_000n,
    maxFeePerGas: 10_000_000_000n,
    maxPriorityFeePerGas: 1_000_000_000n,
    data: "0x",
  };
}

async function authorize(kind) {
  const { securityApi } = require(
    path.join(SRC, "platform", "react-native", "securityApi.ts"),
  );

  const { unlockSession, lockSession } = require(
    path.join(SRC, "core", "security", "sessionLock.ts"),
  );

  unlockSession();

  try {
    // No `outflow` argument: exactly how approvals and swaps call it.
    return await securityApi.reauthorizeTransaction("000000", approval(kind));
  } finally {
    lockSession();
  }
}

test("an approval is refused while the saved policy cannot be read", async () => {
  reset();

  await policyApi.save(JSON.parse(CONFIGURED));

  secure.delete("security.policy.v1");

  const result = await authorize("erc20-approve");

  assert.equal(
    result.ok,
    false,
    "an approval was authorized against a policy nobody could read",
  );
  assert.match(result.message, /limits could not be read/i);
});

test("taking a permission away is still allowed while the policy cannot be read", async () => {
  reset();

  await policyApi.save(JSON.parse(CONFIGURED));

  secure.delete("security.policy.v1");

  const result = await authorize("erc20-revoke");

  assert.equal(
    result.ok,
    true,
    "revoking was blocked, leaving the user exposed to a contract they are cutting off",
  );
});

test("a readable policy still authorizes normally", async () => {
  reset();

  await policyApi.save(JSON.parse(CONFIGURED));

  const result = await authorize("erc20-approve");

  assert.equal(result.ok, true, "the gate refuses even a readable policy");
});

// The import-failure wording used to be asserted against the source text here.
// That kind of check passes on a restatement of the same bug, so the mapping
// moved to core/wallet/describeImportFailure.ts and is exercised directly in
// local-record-recovery.test.cjs.

