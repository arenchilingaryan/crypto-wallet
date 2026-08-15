/* global __dirname */

const assert = require("node:assert/strict");
const path = require("node:path");
const Module = require("node:module");
const { after, beforeEach, test } = require("node:test");

require("sucrase/register/ts");

const REPOSITORY_ROOT = path.join(__dirname, "..", "..");
const SRC = path.join(REPOSITORY_ROOT, "src");
const TRACKED_API_PATH = path.join(
  SRC,
  "platform",
  "react-native",
  "trackedTransactionApi.ts",
);

const originalResolveFilename = Module._resolveFilename;
const originalLoad = Module._load;

Module._resolveFilename = function resolveSecurityAuditAlias(request, ...rest) {
  const mapped = request.startsWith("@/")
    ? path.join(SRC, request.slice(2))
    : request;

  return originalResolveFilename.call(this, mapped, ...rest);
};

const { keccak256 } = require("viem");

const OWNER = "0x0000000000000000000000000000000000000001";
const RECIPIENT = "0x0000000000000000000000000000000000000002";
const HASH = `0x${"11".repeat(32)}`;

// A signed payload and the hash a node would actually return for it.
const SIGNED_RAW = "0x02deadbeef";
const SIGNED_RAW_HASH = keccak256(SIGNED_RAW);

function notFound() {
  const error = new Error("transaction not found");

  error.name = "TransactionNotFoundError";

  return error;
}

const rpc = {
  getTransaction: async () => {
    throw new Error("RPC transport unavailable");
  },
  getTransactionCount: async () => 8,
  sendRawTransaction: async ({ serializedTransaction }) => {
    sentRawTransactions.push(serializedTransaction);

    return keccak256(serializedTransaction);
  },
};

let sentRawTransactions = [];
let updates = [];

const trackedStoreFake = {
  listTrackedTransactions: async () => [],
  saveTrackedTransaction: async (transaction) => transaction,
  updateTrackedTransaction: async (hash, update) => {
    updates.push({ hash, update });
  },
};

Module._load = function loadSecurityAuditFakes(request, parent, isMain) {
  if (parent?.filename === TRACKED_API_PATH) {
    if (request === "./compositionRoot") {
      return {
        walletEngine: {
          getActive: async () => ({ id: "wallet-1", address: OWNER }),
        },
      };
    }

    if (request === "./ethereumPublicClient") {
      return { ethereumPublicClient: rpc };
    }

    if (request === "./priceLookup") {
      return { priceTag: async () => null };
    }

    if (request === "./trackedTransactionStore") {
      return trackedStoreFake;
    }
  }

  if (request === "@react-native-async-storage/async-storage") {
    return asyncStorageFake;
  }

  return originalLoad.call(this, request, parent, isMain);
};

let storageValue = null;

const asyncStorageFake = {
  getItem: async () => storageValue,
  setItem: async (_key, value) => {
    storageValue = value;
  },
};

const { trackedTransactionApi } = require(TRACKED_API_PATH);
const {
  listTrackedTransactions,
  saveTrackedTransaction,
} = require(path.join(
  SRC,
  "platform",
  "react-native",
  "trackedTransactionStore.ts",
));
const { createOutflowGuard, ReservationStateError } = require(path.join(
  SRC,
  "core",
  "security",
  "outflowGuard.ts",
));
const { decidePolicy } = require(path.join(
  SRC,
  "core",
  "security",
  "policyDecision.ts",
));
const { parseSecurityPolicy } = require(path.join(
  SRC,
  "core",
  "security",
  "securityPolicy.ts",
));
const { countsAgainstOutflow } = require(path.join(
  SRC,
  "core",
  "transactions",
  "trackedTransaction.ts",
));

function tracked(overrides = {}) {
  return {
    version: 1,
    hash: HASH,
    chainId: 11155111,
    walletId: "wallet-1",
    from: OWNER,
    to: RECIPIENT,
    assetType: "native",
    symbol: "ETH",
    valueWei: "1",
    valueUsd: 900,
    nonce: 7,
    signedRawTx: "0x02deadbeef",
    gasLimit: "21000",
    broadcastAt: null,
    createdAt: 1_000,
    status: "broadcast-unknown",
    blockNumber: null,
    gasUsed: null,
    effectiveGasPriceWei: null,
    confirmedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  sentRawTransactions = [];
  updates = [];
  storageValue = null;

  rpc.getTransaction = async () => {
    throw new Error("RPC transport unavailable");
  };
  rpc.getTransactionCount = async () => 8;
  rpc.sendRawTransaction = async ({ serializedTransaction }) => {
    sentRawTransactions.push(serializedTransaction);

    return keccak256(serializedTransaction);
  };
});

after(() => {
  Module._resolveFilename = originalResolveFilename;
  Module._load = originalLoad;
});

test("a transport failure is not terminal proof that a pending outflow was superseded", async () => {
  await trackedTransactionApi.resolveUnfinished(tracked());

  assert.notEqual(
    updates.at(-1)?.update.status,
    "reverted",
    "a generic RPC failure was converted into terminal reverted status, which removes the amount from daily outflow accounting",
  );
});

test("a genuinely superseded transaction uses the dedicated superseded state", async () => {
  rpc.getTransaction = async () => {
    const notFound = new Error("transaction not found");
    notFound.name = "TransactionNotFoundError";
    throw notFound;
  };

  await trackedTransactionApi.resolveUnfinished(tracked());

  assert.equal(
    updates.at(-1)?.update.status,
    "superseded",
    "the resolver has a superseded state, but writes reverted instead",
  );
});

test("rebroadcast refuses signed bytes whose hash is not the tracked hash", async () => {
  rpc.getTransactionCount = async () => 7;

  await trackedTransactionApi.resolveUnfinished(
    tracked({
      hash: HASH,
      signedRawTx: "0x02deadbeef",
    }),
  );

  assert.equal(
    sentRawTransactions.length,
    0,
    "mismatched raw bytes reached sendRawTransaction without a local hash-binding check",
  );
});

// The three tests below close the gap left by test 3: there, the transport
// failure alone stops the resend, so the hash binding itself is never
// exercised. These drive the resolver all the way into the rebroadcast branch.

test("a resend that is actually reached still refuses bytes whose hash is not the tracked hash", async () => {
  rpc.getTransaction = async () => {
    throw notFound();
  };
  rpc.getTransactionCount = async () => 7;

  await trackedTransactionApi.resolveUnfinished(
    tracked({
      hash: SIGNED_RAW_HASH,
      signedRawTx: "0x02beefdead",
      status: "broadcast-pending",
    }),
  );

  assert.equal(
    sentRawTransactions.length,
    0,
    "the resolver reached rebroadcast and sent bytes that do not hash to the tracked record",
  );
  assert.equal(
    updates.at(-1)?.update.status,
    "broadcast-unknown",
    "a record whose stored bytes cannot be resent must not stay in a sending state",
  );
});

test("a resend of the exact tracked bytes is still permitted", async () => {
  rpc.getTransaction = async () => {
    throw notFound();
  };
  rpc.getTransactionCount = async () => 7;

  await trackedTransactionApi.resolveUnfinished(
    tracked({
      hash: SIGNED_RAW_HASH,
      signedRawTx: SIGNED_RAW,
      status: "broadcast-pending",
    }),
  );

  assert.deepEqual(sentRawTransactions, [SIGNED_RAW]);
  assert.equal(updates.at(-1)?.update.status, "pending");
});

test("a resend whose returned hash is not the tracked hash is not recorded as sent", async () => {
  rpc.getTransaction = async () => {
    throw notFound();
  };
  rpc.getTransactionCount = async () => 7;
  rpc.sendRawTransaction = async ({ serializedTransaction }) => {
    sentRawTransactions.push(serializedTransaction);

    return HASH;
  };

  await trackedTransactionApi.resolveUnfinished(
    tracked({
      hash: SIGNED_RAW_HASH,
      signedRawTx: SIGNED_RAW,
      status: "broadcast-pending",
    }),
  );

  assert.notEqual(
    updates.at(-1)?.update.status,
    "pending",
    "an RPC that answered with a different hash was accepted as proof of delivery",
  );
});

test("a transport failure leaves a pending outflow counting against the daily limit", async () => {
  await trackedTransactionApi.resolveUnfinished(
    tracked({ status: "broadcast-pending" }),
  );

  const status = updates.at(-1)?.update.status ?? "broadcast-pending";

  assert.equal(
    countsAgainstOutflow(status),
    true,
    `an unanswered lookup moved the record to ${status}, which stops counting against the daily limit`,
  );
  assert.equal(sentRawTransactions.length, 0);
});

test("malformed tracked state is reported as unavailable instead of an empty history", async () => {
  storageValue =
    '[{"version":1,"hash":"0x11","valueUsd":900,"status":"pending"';

  await assert.rejects(
    listTrackedTransactions(),
    /unavailable|corrupt|invalid/i,
    "malformed tracked state was silently treated as an empty transaction history",
  );
});

test("tracked state that parses but is not a list of transactions is unavailable too", async () => {
  storageValue = '{"transactions":[]}';

  await assert.rejects(
    listTrackedTransactions(),
    /unavailable|corrupt|invalid/i,
    "a non-array tracked state was silently treated as an empty history",
  );
});

test("a tracked record missing the fields the app reads is unavailable, not skipped", async () => {
  storageValue = JSON.stringify([
    tracked(),
    { version: 1, hash: "not-a-hash", status: "pending" },
  ]);

  await assert.rejects(
    listTrackedTransactions(),
    /unavailable|corrupt|invalid/i,
    "a malformed record was dropped, quietly lowering today's counted outflow",
  );
});

test("an unknown tracked status is unavailable rather than assumed harmless", async () => {
  storageValue = JSON.stringify([tracked({ status: "whatever" })]);

  await assert.rejects(
    listTrackedTransactions(),
    /unavailable|corrupt|invalid/i,
    "an unrecognised status was accepted, so outflow accounting rests on a guess",
  );
});

test("startup reconciliation cannot turn unreadable reservations into an empty readable ledger", async () => {
  const malformed =
    '[{"id":"held","amountUsd":900,"createdAt":1000}';
  let reservationState = malformed;

  const guard = createOutflowGuard({
    store: {
      read: async () => reservationState,
      write: async (value) => {
        reservationState = value;
      },
    },
    now: () => 2_000,
  });

  await assert.rejects(guard.reconcile(), ReservationStateError);

  let nextAttempt;

  try {
    nextAttempt = await guard.checkAndReserve({
      id: "next",
      amountUsd: 900,
      limitUsd: 1_000,
      spentTodayUsd: async () => 0,
    });
  } catch (error) {
    nextAttempt = error;
  }

  assert.equal(
    nextAttempt instanceof ReservationStateError,
    true,
    `reconcile replaced the unreadable ledger with ${reservationState}; the next reservation returned ${JSON.stringify(nextAttempt)}`,
  );
});

test("a nonempty unreadable policy cannot silently become the default no-limits policy", () => {
  const policy = parseSecurityPolicy(
    '{"version":1,"maxSingleTransferUsd":500,"dailyOutflowLimitUsd":1000',
  );

  const decision = decidePolicy({
    intent: {
      kind: "transfer",
      recipient: RECIPIENT,
      amountUsd: 900,
    },
    policy,
    context: {
      knownRecipients: [],
      spentTodayUsd: 900,
    },
    networkKind: "mainnet",
    priceAvailability: "available",
  });

  assert.equal(
    decision.decision,
    "block",
    `unreadable configured policy became ${decision.decision}/${decision.reason}`,
  );
});

test("concurrent reservations are serialized and cannot both consume the same headroom", async () => {
  let reservationState = null;

  const guard = createOutflowGuard({
    store: {
      read: async () => {
        await Promise.resolve();
        return reservationState;
      },
      write: async (value) => {
        await Promise.resolve();
        reservationState = value;
      },
    },
    now: () => 3_000,
  });

  const results = await Promise.all([
    guard.checkAndReserve({
      id: "first",
      amountUsd: 600,
      limitUsd: 1_000,
      spentTodayUsd: async () => 0,
    }),
    guard.checkAndReserve({
      id: "second",
      amountUsd: 600,
      limitUsd: 1_000,
      spentTodayUsd: async () => 0,
    }),
  ]);

  assert.equal(results.filter((result) => result.ok).length, 1);
  assert.equal(results.filter((result) => !result.ok).length, 1);
});

test("an unreadable reservation ledger fails closed before startup reconciliation", async () => {
  const malformed = '[{"id":"held","amountUsd":900';
  let reservationState = malformed;

  const guard = createOutflowGuard({
    store: {
      read: async () => reservationState,
      write: async (value) => {
        reservationState = value;
      },
    },
    now: () => 4_000,
  });

  await assert.rejects(
    guard.checkAndReserve({
      id: "next",
      amountUsd: 900,
      limitUsd: 1_000,
      spentTodayUsd: async () => 0,
    }),
    ReservationStateError,
  );
  assert.equal(reservationState, malformed);
});

test("concurrent tracked-transaction saves do not lose either local record", async () => {
  const otherHash = `0x${"22".repeat(32)}`;

  await Promise.all([
    saveTrackedTransaction(tracked()),
    saveTrackedTransaction(tracked({ hash: otherHash })),
  ]);

  const saved = await listTrackedTransactions();

  assert.deepEqual(
    new Set(saved.map((transaction) => transaction.hash.toLowerCase())),
    new Set([HASH.toLowerCase(), otherHash.toLowerCase()]),
  );
});
