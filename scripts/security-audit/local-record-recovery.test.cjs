/* global __dirname */

// The audit's FLR-002 and FLR-006 both required the same two things: an
// unreadable local record must fail closed, AND the user must have a readable
// way out. Failing closed with no exit is a wallet that can never send again.
//
// These checks cover the second half, plus the field validation the accounting
// path actually depends on.

const assert = require("node:assert/strict");
const path = require("node:path");
const Module = require("node:module");
const { beforeEach, after, test } = require("node:test");

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

let storage = new Map();

const asyncStorageFake = {
  getItem: async (key) => storage.get(key) ?? null,
  setItem: async (key, value) => {
    storage.set(key, value);
  },
  getAllKeys: async () => [...storage.keys()],
  multiRemove: async (keys) => {
    for (const key of keys) {
      storage.delete(key);
    }
  },
};

Module._load = function loadFakes(request, parent, isMain) {
  if (request === "@react-native-async-storage/async-storage") {
    return asyncStorageFake;
  }

  return originalLoad.call(this, request, parent, isMain);
};

const store = require(
  path.join(SRC, "platform", "react-native", "trackedTransactionStore.ts"),
);

const { createOutflowGuard, ReservationStateError } = require(
  path.join(SRC, "core", "security", "outflowGuard.ts"),
);

const { parseTrackedTransactions } = require(
  path.join(SRC, "core", "transactions", "trackedTransactionState.ts"),
);

const { reducesExposureOnly } = require(
  path.join(SRC, "core", "security", "exposureIntent.ts"),
);

const { allRecordsReadable, recordAction } = require(
  path.join(SRC, "core", "ui", "repairPlan.ts"),
);

const { freeQuarantineKey } = require(
  path.join(SRC, "core", "storage", "quarantineKey.ts"),
);

const { describeImportFailure } = require(
  path.join(SRC, "core", "wallet", "describeImportFailure.ts"),
);

const { mergeActivity } = require(
  path.join(SRC, "core", "blockchain", "mergeActivity.ts"),
);

const { buildPolicyContext, sumTrackedOutflowUsd } = require(
  path.join(SRC, "core", "security", "policyContext.ts"),
);

// panicApi keeps its record in the secure store; a fresh module instance per
// test lets the fake stand in for it without leaking state between cases.
function loadRecipientApi(tracked) {
  const owner = "0x0000000000000000000000000000000000000001";

  function cache(relativePath, exports) {
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

  cache("platform/react-native/compositionRoot.ts", {
    walletEngine: {
      async getActive() {
        return { id: "wallet-1", name: "A", address: owner };
      },
    },
  });

  cache("platform/react-native/trackedTransactionApi.ts", {
    trackedTransactionApi: {
      async listAllForDevice() {
        return tracked;
      },
    },
  });

  cache("core/blockchain/getActivity.ts", {
    async getProvenRecipients() {
      return [];
    },
  });

  const recipientPath = require.resolve(
    path.join(SRC, "platform", "react-native", "recipientApi.ts"),
  );

  delete require.cache[recipientPath];

  return require(recipientPath).recipientApi;
}

function loadPanicApi(state, { failWrites = false, failDeletes = false } = {}) {
  const keyValuePath = require.resolve(
    path.join(SRC, "platform", "react-native", "keyValueStorage.ts"),
  );

  const panicPath = require.resolve(
    path.join(SRC, "platform", "react-native", "panicApi.ts"),
  );

  require.cache[keyValuePath] = {
    id: keyValuePath,
    filename: keyValuePath,
    loaded: true,
    exports: {
      expoKeyValueStorage: {
        async get() {
          return state.value;
        },
        async set(_key, value) {
          if (failWrites) {
            throw new Error("secure store write refused");
          }

          state.value = value;
        },
        async remove() {
          if (failWrites || failDeletes) {
            throw new Error("secure store delete refused");
          }

          state.value = null;
        },
      },
    },
    children: [],
    paths: [],
  };

  delete require.cache[panicPath];

  return require(panicPath).panicApi;
}

const TRACKED_KEY = "transactions.tracked.v1";
const QUARANTINE_KEY = "transactions.tracked.v1.unreadable";

const CORRUPT = '[{"version":1,"hash":"0x11","valueUsd":900,"status":"pending"';

function record(overrides = {}) {
  return {
    version: 1,
    hash: `0x${"11".repeat(32)}`,
    chainId: 1,
    walletId: "wallet-1",
    from: "0x0000000000000000000000000000000000000001",
    to: "0x0000000000000000000000000000000000000002",
    assetType: "native",
    symbol: "ETH",
    valueWei: "1000000000000000000",
    valueUsd: 900,
    createdAt: 1_000,
    status: "pending",
    blockNumber: null,
    gasUsed: null,
    effectiveGasPriceWei: null,
    confirmedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  storage = new Map();
});

after(() => {
  Module._resolveFilename = originalResolveFilename;
  Module._load = originalLoad;
});

test("an unreadable transaction record is reported as unreadable, not as empty", async () => {
  storage.set(TRACKED_KEY, CORRUPT);

  assert.equal(await store.trackedTransactionsReadable(), false);

  await assert.rejects(store.listTrackedTransactions());
});

test("the user can start a new transaction record, and the old one is kept", async () => {
  storage.set(TRACKED_KEY, CORRUPT);

  await store.quarantineTrackedTransactions();

  assert.equal(
    storage.get(QUARANTINE_KEY),
    CORRUPT,
    "the unreadable record was destroyed instead of being kept for inspection",
  );

  assert.equal(await store.trackedTransactionsReadable(), true);

  assert.deepEqual(await store.listTrackedTransactions(), []);
});

test("a readable transaction record cannot be replaced", async () => {
  storage.set(TRACKED_KEY, JSON.stringify([record()]));

  await assert.rejects(
    store.quarantineTrackedTransactions(),
    { name: "ReadableTrackedTransactionsError" },
    "a readable record was wiped, handing back whatever it counted towards today's limit",
  );

  assert.deepEqual(
    JSON.parse(storage.get(TRACKED_KEY)).length,
    1,
    "the readable record was replaced anyway",
  );
});

test("a second repair does not overwrite what the first one kept", async () => {
  storage.set(TRACKED_KEY, CORRUPT);

  await store.quarantineTrackedTransactions();

  const second = '[{"version":1,"hash":"0x22"';

  storage.set(TRACKED_KEY, second);

  await store.quarantineTrackedTransactions();

  assert.equal(
    storage.get(QUARANTINE_KEY),
    CORRUPT,
    "the first unreadable record was overwritten, so 'the old one is kept' is false",
  );
  assert.equal(storage.get(`${QUARANTINE_KEY}.1`), second);
});

test("nothing quarantines the record on its own", async () => {
  storage.set(TRACKED_KEY, CORRUPT);

  await store.trackedTransactionsReadable();

  try {
    await store.saveTrackedTransaction(record());
  } catch {
    // Expected: writing needs a readable record.
  }

  try {
    await store.getTrackedTransaction(`0x${"11".repeat(32)}`);
  } catch {
    // Expected.
  }

  assert.equal(
    storage.get(TRACKED_KEY),
    CORRUPT,
    "an ordinary read or write silently replaced the unreadable record",
  );
  assert.equal(storage.get(QUARANTINE_KEY), undefined);
});

test("a record whose valueWei cannot become a BigInt is refused", () => {
  // policyContext.sumTrackedOutflowUsd calls BigInt(item.valueWei) outside any
  // try/catch on the send path.
  for (const valueWei of ["", "1.5", "0x10", "abc", null, 1]) {
    assert.throws(
      () => parseTrackedTransactions(JSON.stringify([record({ valueWei })])),
      { name: "TrackedTransactionStateError" },
      `valueWei ${JSON.stringify(valueWei)} was accepted`,
    );
  }

  assert.equal(
    parseTrackedTransactions(JSON.stringify([record()])).length,
    1,
    "a well-formed record was rejected",
  );
});

test("a record whose tokenDecimals viem would reject is refused", () => {
  // The same line calls formatUnits(wei, tokenDecimals). viem throws on a
  // negative value, and a huge one asks it to build a string of that length.
  // Neither throw is a TrackedTransactionStateError, so it would escape the
  // unreadable-record handling entirely: nothing sends, and the repair screen
  // reports the record as fine.
  for (const tokenDecimals of [-1, 256, 2 ** 31, 1.5, Number.NaN]) {
    assert.throws(
      () =>
        parseTrackedTransactions(JSON.stringify([record({ tokenDecimals })])),
      { name: "TrackedTransactionStateError" },
      `tokenDecimals ${String(tokenDecimals)} was accepted`,
    );
  }

  for (const tokenDecimals of [0, 6, 18, 255]) {
    assert.equal(
      parseTrackedTransactions(JSON.stringify([record({ tokenDecimals })]))
        .length,
      1,
      `a real token with ${tokenDecimals} decimals was rejected`,
    );
  }
});

test("the transaction record is parked before the live one is replaced", async () => {
  storage.set(TRACKED_KEY, CORRUPT);

  const order = [];

  const realSetItem = asyncStorageFake.setItem;

  asyncStorageFake.setItem = async (key, value) => {
    order.push(key === TRACKED_KEY ? "wipe-live" : "park-copy");

    return realSetItem(key, value);
  };

  try {
    await store.quarantineTrackedTransactions();
  } finally {
    asyncStorageFake.setItem = realSetItem;
  }

  assert.deepEqual(
    order,
    ["park-copy", "wipe-live"],
    "the live record was replaced before the copy was safely stored",
  );
});

test("the fields Activity and the ledger screen read are validated too", () => {
  // mergeActivity does BigInt(valueOutWei) and formatUnits(_, tokenOutDecimals),
  // getTransactionDetails does BigInt(gasUsed) and BigInt(blockNumber). None of
  // those throws a TrackedTransactionStateError, so an unchecked record here
  // reads as "fine" while a screen crashes and Repair offers nothing.
  const bad = [
    { valueOutWei: "abc" },
    { valueOutWei: "-1" },
    { tokenOutDecimals: -1 },
    { tokenOutDecimals: 2 ** 31 },
    { gasUsed: "0x10" },
    { effectiveGasPriceWei: "1.5" },
    { blockNumber: "not-a-number" },
    { minAmountOutWei: "1e18" },
    { actualAmountOutWei: {} },
  ];

  for (const overrides of bad) {
    assert.throws(
      () => parseTrackedTransactions(JSON.stringify([record(overrides)])),
      { name: "TrackedTransactionStateError" },
      `${JSON.stringify(overrides)} was accepted`,
    );
  }

  const good = record({
    valueOutWei: "500000000000000000",
    tokenOutDecimals: 6,
    gasUsed: "21000",
    effectiveGasPriceWei: "1000000000",
    blockNumber: "12345",
    minAmountOutWei: "1",
    actualAmountOutWei: "2",
  });

  assert.equal(parseTrackedTransactions(JSON.stringify([good])).length, 1);
});

test("a reader survives a field the validator never heard of", () => {
  // Four rounds of review found this same shape one field further along. The
  // validator is one wall; this is the other, so the next unlisted field
  // degrades to "unknown" instead of taking a screen down.
  const wallet = "0x0000000000000000000000000000000000000001";

  const hostile = {
    ...record(),
    assetType: "swap",
    symbolOut: 42,
    valueOutWei: null,
    tokenOutDecimals: -1,
    blockNumber: "not-a-number",
    valueWei: "nonsense",
  };

  const merged = mergeActivity([], [hostile], wallet);

  assert.equal(merged.length, 1);
  assert.equal(merged[0].blockNumber, null);
  assert.equal(merged[0].amountOut, undefined);
  assert.equal(merged[0].amountOutIsQuote, false);
  assert.equal(merged[0].symbolOut, undefined);

  // A readable amount with an unusable decimals value: formatUnits itself is
  // what throws here, so the guard has to be on the decimals, not just on the
  // amount short-circuiting first.
  const badDecimals = mergeActivity(
    [],
    [
      {
        ...record(),
        assetType: "swap",
        symbolOut: "USDC",
        valueOutWei: "1000000",
        tokenOutDecimals: -1,
      },
    ],
    wallet,
  );

  assert.equal(badDecimals.length, 1);
  assert.equal(typeof badDecimals[0].amountOut, "string");

  const hugeDecimals = mergeActivity(
    [],
    [
      {
        ...record(),
        assetType: "swap",
        symbolOut: "USDC",
        valueOutWei: "1000000",
        tokenOutDecimals: 2 ** 31,
      },
    ],
    wallet,
  );

  assert.equal(typeof hugeDecimals[0].amountOut, "string");

  // And the same for the incoming amount's own decimals.
  const badInDecimals = mergeActivity(
    [],
    [{ ...record(), assetType: "erc20", tokenDecimals: -1 }],
    wallet,
  );

  assert.equal(typeof badInDecimals[0].amount, "string");
});

test("the parked copies can be let go of, so the full-quarantine refusal is true", async () => {
  storage.set(TRACKED_KEY, CORRUPT);

  await store.quarantineTrackedTransactions();

  assert.deepEqual(await store.keptUnreadableRecords(), [QUARANTINE_KEY]);

  const forgotten = await store.forgetKeptUnreadableRecords();

  assert.equal(forgotten, 1);
  assert.deepEqual(await store.keptUnreadableRecords(), []);
  assert.equal(storage.has(QUARANTINE_KEY), false);
});

test("an unreadable reservation ledger is reported and can be replaced deliberately", async () => {
  let state = '[{"id":"held","amountUsd":900';

  const guard = createOutflowGuard({
    store: {
      read: async () => state,
      write: async (value) => {
        state = value;
      },
    },
    now: () => 1_000,
  });

  assert.equal(await guard.readable(), false);

  await assert.rejects(
    guard.checkAndReserve({
      id: "next",
      amountUsd: 900,
      limitUsd: 1_000,
      spentTodayUsd: async () => 0,
    }),
    ReservationStateError,
  );

  assert.equal(state, '[{"id":"held","amountUsd":900');

  // The copy has to be safely stored before the live ledger is replaced: a
  // crash in between would otherwise lose the only record of holds that were
  // already counted against today's limit.
  const order = [];

  await guard.quarantine(async (raw) => {
    order.push(`preserve:${raw}`);
    order.push(`liveStillIntact:${state !== "[]"}`);
  });

  assert.deepEqual(order, [
    'preserve:[{"id":"held","amountUsd":900',
    "liveStillIntact:true",
  ]);
  assert.equal(await guard.readable(), true);
});

test("a readable reservation ledger cannot be replaced", async () => {
  let state = null;

  const guard = createOutflowGuard({
    store: {
      read: async () => state,
      write: async (value) => {
        state = value;
      },
    },
    now: () => 1_000,
  });

  let preserved = false;

  await assert.rejects(
    guard.quarantine(async () => {
      preserved = true;
    }),
    { name: "ReadableReservationsError" },
    "a readable ledger was wiped, releasing every hold it accounted for",
  );

  assert.equal(preserved, false);
  assert.equal(state, null);
});

test("the repair screen asks twice, on the screen itself", () => {
  // Alert is a no-op on react-native-web, so a modal here would leave the only
  // way out of an unreadable record silently doing nothing.
  assert.equal(recordAction("unreadable", "a", null), "offer");
  assert.equal(recordAction("unreadable", "a", "a"), "confirm");
  assert.equal(recordAction("unreadable", "a", "b"), "offer");

  for (const state of ["readable", "unknown"]) {
    assert.equal(
      recordAction(state, "a", "a"),
      "none",
      `${state} offered a repair`,
    );
  }
});

test("an unchecked record never counts towards the all-clear", () => {
  assert.equal(allRecordsReadable(["readable", "readable"]), true);
  assert.equal(allRecordsReadable(["readable", "unknown"]), false);
  assert.equal(allRecordsReadable(["readable", "unreadable"]), false);
  assert.equal(allRecordsReadable([]), false);
});

test("a repair has nowhere left to park rather than deleting an older copy", async () => {
  const kept = new Map();

  await assert.rejects(
    freeQuarantineKey("base", async (key) => {
      kept.set(key, true);

      return "occupied";
    }),
    { name: "QuarantineFullError" },
    "the last slot was silently reused, deleting a copy the screen promises is kept",
  );
});

test("only the phrase itself is reported as an invalid phrase", () => {
  assert.equal(
    describeImportFailure(new Error("Invalid mnemonic")),
    "Invalid recovery phrase",
  );

  for (const error of [
    new Error("Wallet storage is unavailable"),
    Object.assign(new Error("nope"), { name: "WalletSecretNotDurableError" }),
    "not an error",
  ]) {
    assert.notEqual(
      describeImportFailure(error),
      "Invalid recovery phrase",
      `${String(error)} was reported as a bad recovery phrase`,
    );
  }
});

// A planted local record must not be able to change a policy verdict. These
// two are the paths that read local history into the decision.

test("a planted record cannot make an unknown recipient look familiar", () => {
  const owner = "0x0000000000000000000000000000000000000001";
  const stranger = "0x0000000000000000000000000000000000009999";

  const planted = {
    ...record(),
    to: stranger,
    status: "confirmed",
    blockNumber: null,
    gasUsed: null,
    confirmedAt: null,
  };

  const context = buildPolicyContext({
    owner,
    activity: [],
    tracked: [planted],
    priceOf: () => null,
    now: planted.createdAt + 1,
  });

  assert.deepEqual(
    context.knownRecipients,
    [],
    "a record claiming 'confirmed' with no block, gas or confirmation time was taken as proof the user has sent there",
  );

  // The same record, with what only the chain can supply, does count.
  const real = buildPolicyContext({
    owner,
    activity: [],
    tracked: [
      {
        ...planted,
        blockNumber: "18000000",
        gasUsed: "21000",
        confirmedAt: planted.createdAt,
      },
    ],
    priceOf: () => null,
    now: planted.createdAt + 1,
  });

  assert.deepEqual(real.knownRecipients, [stranger.toLowerCase()]);

  // Every piece has to be there. A record that supplies one and not the others
  // is still just this device's own claim.
  for (const partial of [
    { blockNumber: "18000000" },
    { gasUsed: "21000" },
    { confirmedAt: planted.createdAt },
    { blockNumber: "18000000", gasUsed: "21000" },
    { blockNumber: "18000000", confirmedAt: planted.createdAt },
  ]) {
    const context = buildPolicyContext({
      owner,
      activity: [],
      tracked: [{ ...planted, ...partial }],
      priceOf: () => null,
      now: planted.createdAt + 1,
    });

    assert.deepEqual(
      context.knownRecipients,
      [],
      `${JSON.stringify(partial)} was accepted as proof the transfer was mined`,
    );
  }
});

test("an unreadable lockdown record leaves signing refused and a way out visible", async () => {
  const state = { value: '{"version":1,"frozenAt":10,"until":1}' };

  const panic = loadPanicApi(state);

  const status = await panic.status();

  assert.equal(
    status.frozen,
    true,
    "an unreadable lockdown was reported as not locked, so nothing would stop signing",
  );
  assert.equal(
    status.readable,
    false,
    "the screen has no way to tell that there is no end time to wait out",
  );

  // The screen renders the unfreeze path from these two.
  assert.equal(status.unfreezeRequested, true);
  assert.equal(status.unfreezeReadyInMs, 0);

  await panic.requestUnfreeze();

  const lifted = await panic.completeUnfreeze();

  assert.equal(lifted.ok, true, "the lockdown could not be lifted at all");
  assert.equal(state.value, null, "the unreadable record was left in place");

  assert.equal((await panic.status()).frozen, false);
});

test("a lockdown record that cannot be tidied up still shows its controls", async () => {
  // The expired-record cleanup used to run outside the guard, so a store that
  // refused the delete took the whole screen down — and with it both unlock
  // buttons — while signing stayed refused.
  const expired = Date.now() - 60 * 60 * 1000;

  const state = {
    value: JSON.stringify({
      version: 1,
      frozenAt: expired - 60 * 60 * 1000,
      until: expired,
      seen: expired,
      unfreezeRequestedAt: null,
    }),
  };

  const panic = loadPanicApi(state, { failWrites: true });

  const status = await panic.status();

  assert.equal(status.frozen, false);
  assert.equal(status.readable, true);
});

test("an unreadable lockdown can be lifted even if the store refuses a delete", async () => {
  // The way out must not depend on one storage operation succeeding: signing
  // is refused while the record stands, and the recovery phrase cannot be
  // shown either, so a failed delete would brick the wallet.
  const state = { value: '{"version":1,"frozenAt":10,"until":1,"seen":10}' };

  const panic = loadPanicApi(state, { failDeletes: true });

  assert.equal((await panic.status()).frozen, true);

  await panic.requestUnfreeze();

  const lifted = await panic.completeUnfreeze();

  assert.equal(lifted.ok, true, "the lockdown could not be lifted");

  assert.equal(
    (await panic.status()).frozen,
    false,
    "signing is still refused after the lockdown was lifted",
  );
});

test("a lockdown the user asked for and did not get is reported, not swallowed", async () => {
  const state = { value: null };

  const panic = loadPanicApi(state, { failWrites: true });

  await assert.rejects(
    panic.freeze(),
    "the emergency lockdown failed silently and the screen would show nothing",
  );
});

test("the recipient panel does not take a local record's word for it", async () => {
  const stranger = "0x0000000000000000000000000000000000009999";

  const planted = {
    ...record(),
    to: stranger,
    status: "confirmed",
    blockNumber: null,
    gasUsed: null,
    confirmedAt: null,
  };

  const withPlanted = await loadRecipientApi([planted]).analyze(stranger);

  assert.notEqual(
    withPlanted.identity,
    "previously-sent",
    "a planted local record made a stranger read as somewhere the user has sent before",
  );

  const real = {
    ...planted,
    blockNumber: "18000000",
    gasUsed: "21000",
    confirmedAt: planted.createdAt,
  };

  const withReal = await loadRecipientApi([real]).analyze(stranger);

  assert.equal(
    withReal.identity,
    "previously-sent",
    "a genuine confirmed transfer stopped counting as familiar",
  );
});

test("a record with no way to repair it never offers the button", () => {
  assert.equal(recordAction("unreadable", "lockdown", null, false), "none");
  assert.equal(recordAction("unreadable", "lockdown", "lockdown", false), "none");
  assert.equal(recordAction("unreadable", "records", null, true), "offer");
});

test("a record cannot claim 'confirmed' without what only a chain supplies", () => {
  // Otherwise the word means one thing to the validator and another to every
  // reader that acts on it, and a record silently drops out of the reference
  // set the lookalike detector compares an address against.
  for (const missing of [
    { blockNumber: null },
    { gasUsed: null },
    { confirmedAt: null },
  ]) {
    assert.throws(
      () =>
        parseTrackedTransactions(
          JSON.stringify([
            {
              ...record(),
              status: "confirmed",
              blockNumber: "18000000",
              gasUsed: "21000",
              confirmedAt: 2_000,
              ...missing,
            },
          ]),
        ),
      { name: "TrackedTransactionStateError" },
      `a 'confirmed' record missing ${Object.keys(missing)[0]} was accepted`,
    );
  }

  assert.equal(
    parseTrackedTransactions(
      JSON.stringify([
        {
          ...record(),
          status: "confirmed",
          blockNumber: "18000000",
          gasUsed: "21000",
          confirmedAt: 2_000,
        },
      ]),
    ).length,
    1,
    "a real confirmation was rejected",
  );

  // Everything that is not a confirmation keeps its nulls.
  assert.equal(parseTrackedTransactions(JSON.stringify([record()])).length, 1);
});

test("a negative stored amount cannot hand back spent daily limit", () => {
  const owner = "0x0000000000000000000000000000000000000001";

  // Rejected on the way in...
  assert.throws(
    () => parseTrackedTransactions(JSON.stringify([record({ valueUsd: -4990 })])),
    { name: "TrackedTransactionStateError" },
    "a negative outflow amount was accepted into the record",
  );

  // ...and it could not subtract even if it got there.
  const spent = sumTrackedOutflowUsd({
    owner,
    tracked: [record({ valueUsd: 5000 }), record({ valueUsd: -4990 })],
    priceOf: () => null,
    now: 1_001,
  });

  assert.equal(
    spent,
    5000,
    `a stored negative reduced today's counted outflow to ${spent}`,
  );
});

test("only taking permission away is exempt from the unreadable-policy refusal", () => {
  assert.equal(reducesExposureOnly("erc20-revoke"), true);
  assert.equal(reducesExposureOnly("permit2-revoke"), true);

  for (const kind of [
    "native-transfer",
    "erc20-transfer",
    "erc20-approve",
    "swap",
  ]) {
    assert.equal(
      reducesExposureOnly(kind),
      false,
      `${kind} was treated as exposure-reducing`,
    );
  }
});
