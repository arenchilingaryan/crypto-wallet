import { webcrypto } from "node:crypto";

import { bytesToHex } from "@noble/hashes/utils.js";

import {
  formatUnits,
  parseTransaction,
  serializeTransaction,
  type Address,
} from "viem";
import { mnemonicToAccount, privateKeyToAccount } from "viem/accounts";

import type { RandomSource } from "@/core/ports/randomSource";
import type {
  SignableTransaction,
  WalletSigner,
} from "@/core/ports/walletSigner";

import { TransactionValidationError } from "@/core/transactions/nativeTransfer";
import { assertSaneFee } from "@/core/transactions/feeGuard";

import { confirmMnemonic } from "@/core/wallet/confirmMnemonic";
import {
  openWalletVault,
  parseWalletVault,
  sealWalletVault,
  VaultOpenError,
} from "@/core/wallet/walletVault";
import {
  openOrCreateVault,
  stageRotation,
  type SlotStore,
} from "@/core/wallet/vaultSlots";
import {
  parseVaultKeySlot,
  serializeVaultKeySlot,
  unwrapMasterKey,
  VaultKeyError,
  wrapMasterKey,
} from "@/core/wallet/vaultMasterKey";
import { importWallet } from "@/core/wallet/importWallet";
import { revealSecret } from "@/core/wallet/revealSecret";
import {
  createWalletEngine,
  type WalletAccount as WalletAccountShape,
} from "@/core/wallet/walletEngine";

import type { SecretStore } from "@/core/ports/secretStore";
import type { KeyValueStorage } from "@/core/ports/keyValueStorage";
import type { WalletSecret } from "@/core/wallet/walletSecret";

import { createLocalMnemonicSigner } from "@/core/signing/localMnemonicSigner";
import { signMessage } from "@/core/signing/signMessage";
import { signNativeTransfer } from "@/core/signing/signNativeTransfer";

import { unlockSession } from "@/core/security/sessionLock";
import { grantTransactionAuthorization } from "@/core/security/transactionAuthorization";

import { prepareErc20Revoke } from "@/core/transactions/prepareErc20Revoke";
import { prepareErc20Transfer } from "@/core/transactions/prepareErc20Transfer";
import { prepareNativeTransfer } from "@/core/transactions/prepareNativeTransfer";

import { signErc20Revoke } from "@/core/signing/signErc20Revoke";
import { signErc20Transfer } from "@/core/signing/signErc20Transfer";

import { configureCore } from "@/core/config/runtimeConfig";
import { WalletLockedError } from "@/core/security/sessionLock";

import { createPin, hasPin, verifyPin } from "@/core/security/pin";
import {
  advanceFreeze,
  canUnfreezeNow,
  createFreeze,
  describeRemaining,
  FREEZE_DURATION_MS,
  FreezeStateUnreadableError,
  isFrozen,
  requestUnfreeze,
  UNFREEZE_COOLDOWN_MS,
  unfreezeReadyInMs,
  parseFreeze,
  remainingFreezeMs,
  serializeFreeze,
  WalletFrozenError,
} from "@/core/security/panicFreeze";
import { parsePinVerifier } from "@/core/security/pinVerifier";
import { resolveBroadcast } from "@/core/transactions/resolveBroadcast";
import { buildExecutionStory } from "@/core/transactions/executionStory";
import { quoteToBlockSeconds } from "@/core/transactions/analyzeExecution";
import {
  decideTradeGate,
  decideTradeGateForAll,
  describeTradeGate,
  outOfCoverage,
  requiresTradeBriefing,
  tradeTargets,
} from "@/core/transactions/tradeGate";
import { buildTokenIntelligence } from "@/core/token-intelligence/buildTokenIntelligence";
import { executionFromTracked } from "@/core/transactions/transactionDetails";
import {
  countsAgainstOutflow,
  isAwaitingChain,
  type TrackedTransactionStatus,
} from "@/core/transactions/trackedTransaction";

import { buildPolicyContext } from "@/core/security/policyContext";
import {
  decidePolicy,
  toAmountUsd,
  type PolicyIntent,
} from "@/core/security/policyDecision";
import {
  evaluateSecurityPolicy,
  parseSecurityPolicy,
  serializeSecurityPolicy,
  type SecurityPolicy,
} from "@/core/security/securityPolicy";

import {
  approvalExposureUsd,
  getApprovals,
  scoreApproval,
  type ApprovalScan,
  type TokenApproval,
} from "@/core/blockchain/getApprovals";
import { buildSecurityReview } from "@/core/security/securityReviewSummary";
import {
  addWatched,
  canEnrichOnNetwork,
  isWatched,
  MAX_WATCHLIST_ITEMS,
  removeWatched,
  sameWatchedAsset,
  searchWatchlist,
  sortWatchlist,
  watchKey,
} from "@/core/watchlist/watchlist";
import {
  parseWatchlist,
  serializeWatchlist,
  WATCHLIST_STORAGE_KEY,
} from "@/core/watchlist/storage";
import { runBounded } from "@/core/watchlist/refreshQueue";
import { createWatchlistStore } from "@/core/watchlist/watchlistStore";
import {
  assetRouteKey,
  assetRouteParams,
  parseRouteChainId,
} from "@/core/navigation/assetRoute";
import { buildWatchRowObservation } from "@/core/watchlist/observation";
import type { WatchedToken } from "@/core/watchlist/types";
import {
  chunkRange,
  computeCoverage,
  extractCandidatePairs,
  mergePairs,
  parseDiscoveryState,
  planScanRange,
  scannedFrontier,
  serializeDiscoveryState,
  type ApprovalLogRecord,
  type ScanRange,
} from "@/core/blockchain/approvalDiscovery";
import { scanApprovalGraph } from "@/core/blockchain/scanApprovalGraph";
import { provenRecipientsFromTransfers } from "@/core/blockchain/getActivity";
import {
  addressFingerprint,
  truncateAddress,
} from "@/core/blockchain/addressFingerprint";
import { analyzeRecipient } from "@/core/security/recipientIntelligence";
import { shortenAddress } from "@/utils/format";
import { normalizeTokenBalance } from "@/core/blockchain/getPortfolio";
import { getKnownSpenders } from "@/core/blockchain/knownSpenders";
import {
  getPermit2Spenders,
  isPermit2Expired,
  PERMIT2_UNLIMITED,
} from "@/core/blockchain/permit2";
import { encodePermit2Revoke } from "@/core/transactions/permit2Revoke";
import { validateSwapIntent } from "@/core/transactions/swap";
import { mergeActivity } from "@/core/blockchain/mergeActivity";
import {
  isOutflow,
  presentActivity,
  resolveDirection,
} from "@/core/blockchain/activity";
import {
  describeValuation,
  valuePortfolio,
} from "@/core/blockchain/valuePortfolio";
import { DEFAULT_SECURITY_POLICY } from "@/core/security/securityPolicy";
import {
  createOutflowGuard,
  ReservationStateError,
} from "@/core/security/outflowGuard";
import { analyzeExecution } from "@/core/transactions/analyzeExecution";
import {
  creditedFromLogs,
  ERC20_TRANSFER_TOPIC,
} from "@/core/transactions/executionFacts";
import {
  reviewApproval,
  reviewSwap,
  reviewTransfer,
} from "@/core/security/securityReview";
import { resolveDetailsAsset } from "@/core/transactions/transactionDetails";
import {
  addDecimalAmounts,
  isPositiveAmount,
} from "@/core/blockchain/decimalAmount";
import { getUniswapDeployment } from "@/core/blockchain/uniswap";

function createMemoryStorage(): KeyValueStorage {
  const map = new Map<string, string>();

  return {
    async get(key) {
      return map.get(key) ?? null;
    },

    async set(key, value) {
      map.set(key, value);
    },

    async remove(key) {
      map.delete(key);
    },
  };
}

function createMemorySecretStore(): SecretStore {
  const map = new Map<string, WalletSecret>();

  return {
    async load(walletId) {
      return map.get(walletId) ?? null;
    },

    async save(walletId, secret) {
      map.set(walletId, secret);
      return { durable: true };
    },

    async remove(walletId) {
      map.delete(walletId);
    },
  };
}

const nodeRandom: RandomSource = {
  async getBytes(length) {
    return webcrypto.getRandomValues(new Uint8Array(length));
  },
};

const fakeClient = {
  getChainId: async () => 1,
  getBalance: async () => 10n ** 18n,
  getTransactionCount: async () => 7,
  estimateGas: async () => 21_000n,
  estimateFeesPerGas: async () => ({
    maxFeePerGas: 30n * 10n ** 9n,
    maxPriorityFeePerGas: 10n ** 9n,
  }),
};

function makeSigner(
  mnemonic: string,
  sign: (
    account: ReturnType<typeof mnemonicToAccount>,
    transaction: SignableTransaction,
  ) => Promise<`0x${string}`>,
): WalletSigner {
  const account = mnemonicToAccount(mnemonic);

  return {
    async getAddress() {
      return account.address;
    },

    async signMessage(message) {
      return account.signMessage({ message });
    },

    async signTransaction(transaction) {
      return sign(account, transaction);
    },
  };
}

const fakeErc20Client = {
  ...fakeClient,
  estimateGas: async () => 65_000n,
  readContract: async () => 10_000_000n,
};

let failed = 0;

function check(label: string, passed: boolean, detail = "") {
  console.log(
    `${passed ? "ok  " : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`,
  );

  if (!passed) {
    failed += 1;
  }
}

async function expectRejected(
  label: string,
  transaction: Parameters<typeof signNativeTransfer>[0]["transaction"],
  signer: WalletSigner,
  expectedFragment: string,
) {
  grantTransactionAuthorization(transaction, `token-${label}`);

  let error: unknown = null;

  try {
    await signNativeTransfer(
      {
        transaction,
        authorization: `token-${label}`,
        expectedChainId: 1,
      },
      signer,
    );
  } catch (caught) {
    error = caught;
  }

  const message = error instanceof Error ? error.message : "no error was thrown";

  check(
    label,
    error instanceof TransactionValidationError &&
      message.includes(expectedFragment),
    message,
  );
}

export async function main() {
  configureCore({ dataApiKey: "test-key" });

  const storage = createMemoryStorage();

  const secrets = createMemorySecretStore();

  const engine = createWalletEngine({
    storage,
    secrets,
    random: nodeRandom,
  });

  const prepared0 = await engine.prepare();

  const registryBeforeConfirm = await engine.list();

  const createdAccount = await engine.create(prepared0.recoveryPhrase);

  const created = { account: createdAccount };

  const generated = {
    address: createdAccount.address,
    mnemonic: prepared0.recoveryPhrase,
  };

  check(
    "prepare() persists nothing before confirmation",
    registryBeforeConfirm.length === 0 &&
      (await engine.list()).length === 1 &&
      prepared0.address === createdAccount.address,
  );

  check(
    "WalletEngine.create",
    generated.mnemonic.split(" ").length === 12 &&
      generated.address.startsWith("0x"),
    generated.address,
  );

  check(
    "confirmMnemonic",
    confirmMnemonic(generated.mnemonic, [
      { index: 2, word: generated.mnemonic.split(" ")[2] },
    ]),
  );

  check(
    "importWallet restores the same address",
    importWallet(generated.mnemonic).address === generated.address,
  );

  const wallets = await engine.list();

  const active = await engine.getActive();

  check(
    "WalletEngine: registry and active wallet",
    wallets.length === 1 && active?.address === generated.address,
    active?.name,
  );

  const storedSecret = await secrets.load(created.account.id);

  check(
    "SecretStore stores a versioned secret",
    storedSecret?.version === 1 && storedSecret.mnemonic === generated.mnemonic,
  );

  unlockSession();

  const signer = createLocalMnemonicSigner({ engine, secrets });

  check(
    "WalletSigner.getAddress",
    (await signer.getAddress()) === generated.address,
  );

  const signed = await signMessage({ message: "hexagonal" }, signer);

  check(
    "signMessage through the port",
    signed.signature.startsWith("0x") && signed.address === generated.address,
  );

  const prepared = await prepareNativeTransfer(
    {
      kind: "native-transfer",
      chainId: 1,
      from: generated.address,
      to: "0x000000000000000000000000000000000000dEaD",
      value: 10n ** 15n,
    },
    { expectedChainId: 1, expectedFrom: generated.address },
    
    fakeClient as never,
  );

  check(
    "prepareNativeTransfer against a stub network",
    prepared.nonce === 7 && prepared.gas === 21_000n,
  );

  grantTransactionAuthorization(prepared, "node-test-token");

  const rawTransaction = await signNativeTransfer(
    {
      transaction: prepared,
      authorization: "node-test-token",
      expectedChainId: 1,
    },
    signer,
  );

  check(
    "signNativeTransfer through the port",
    rawTransaction.startsWith("0x02"),
    `${rawTransaction.slice(0, 14)}…`,
  );

  const GWEI = 1_000_000_000n;

  function feeRejected(
    maxFeePerGas: bigint,
    maxPriorityFeePerGas: bigint,
    gas = 21_000n,
  ) {
    try {
      assertSaneFee({ gas, maxFeePerGas, maxPriorityFeePerGas });

      return null;
    } catch (error) {
      return error instanceof TransactionValidationError ? error.code : "other";
    }
  }

  check(
    "a priority fee large enough to drain the balance as a tip is refused",
    feeRejected(6000n * GWEI, 6000n * GWEI) === "INVALID_PRIORITY_FEE",
    "a hostile RPC cannot make the wallet sign away its ETH as a priority tip",
  );

  check(
    "an absurd maximum fee per gas is refused even with a zero tip",
    feeRejected(50_000n * GWEI, 0n) === "INVALID_MAX_FEE",
    "no real gas price approaches this ceiling",
  );

  check(
    "a gas limit above the block gas limit is refused",
    feeRejected(80n * GWEI, 2n * GWEI, 40_000_000n) === "INVALID_GAS",
    "a hostile RPC cannot inflate the fee or block sends with an impossible gas limit",
  );

  check(
    "an ordinary fee still passes the guard untouched",
    feeRejected(80n * GWEI, 2n * GWEI, 150_000n) === null,
    "the ceiling sits far above any real gas price",
  );

  const drainingTransfer = {
    ...prepared,
    maxPriorityFeePerGas: 6000n * GWEI,
    maxFeePerGas: 6000n * GWEI,
  };

  grantTransactionAuthorization(drainingTransfer, "draining-transfer");

  let drainingSignRejected = false;

  try {
    await signNativeTransfer(
      {
        transaction: drainingTransfer,
        authorization: "draining-transfer",
        expectedChainId: 1,
      },
      signer,
    );
  } catch (error) {
    drainingSignRejected =
      error instanceof TransactionValidationError &&
      error.code === "INVALID_PRIORITY_FEE";
  }

  check(
    "the signing path itself refuses a draining fee, not just the standalone guard",
    drainingSignRejected,
    "removing the fee guard from the transfer validator would let this through",
  );

  const otherStorage = createMemoryStorage();

  const otherSecrets = createMemorySecretStore();

  const otherEngine = createWalletEngine({
    storage: otherStorage,
    secrets: otherSecrets,
    random: nodeRandom,
  });

  const otherPrepared = await otherEngine.prepare();

  await otherEngine.create(otherPrepared.recoveryPhrase);

  const otherWallet = { mnemonic: otherPrepared.recoveryPhrase };

  const otherSigner = createLocalMnemonicSigner({
    engine: otherEngine,
    secrets: otherSecrets,
  });

  grantTransactionAuthorization(prepared, "cross-wallet-token");

  let refusedForeignSigner = false;

  try {
    await signNativeTransfer(
      {
        transaction: prepared,
        authorization: "cross-wallet-token",
        expectedChainId: 1,
      },
      otherSigner,
    );
  } catch {
    refusedForeignSigner = true;
  }

  check(
    "a foreign signer does not sign the wallet's transaction",
    refusedForeignSigner,
  );

  const rogueAccount = mnemonicToAccount(otherWallet.mnemonic);

  const impostorSigner: WalletSigner = {
    async getAddress() {
      return generated.address;
    },

    async signMessage(message) {
      return rogueAccount.signMessage({ message });
    },

    async signTransaction(transaction) {
      return rogueAccount.signTransaction({
        type: "eip1559",
        chainId: transaction.chainId,
        to: transaction.to,
        value: transaction.value,
        nonce: transaction.nonce,
        gas: transaction.gas,
        maxFeePerGas: transaction.maxFeePerGas,
        maxPriorityFeePerGas: transaction.maxPriorityFeePerGas,
        data: transaction.data,
      });
    },
  };

  grantTransactionAuthorization(prepared, "impostor-token");

  let impostorError: unknown = null;

  try {
    await signNativeTransfer(
      {
        transaction: prepared,
        authorization: "impostor-token",
        expectedChainId: 1,
      },
      impostorSigner,
    );
  } catch (error) {
    impostorError = error;
  }

  check(
    "a signature by a foreign key posing as our address is rejected",
    impostorError instanceof TransactionValidationError &&
      impostorError.code === "INVALID_FROM",
    impostorError instanceof TransactionValidationError
      ? impostorError.code
      : "no error was thrown",
  );

  const tamperingSigner: WalletSigner = {
    async getAddress() {
      return generated.address;
    },

    async signMessage(message) {
      return signer.signMessage(message);
    },

    async signTransaction(transaction) {
      return signer.signTransaction({
        ...transaction,
        to: "0x000000000000000000000000000000000000bEEF",
      });
    },
  };

  grantTransactionAuthorization(prepared, "tamper-token");

  let tamperError: unknown = null;

  try {
    await signNativeTransfer(
      {
        transaction: prepared,
        authorization: "tamper-token",
        expectedChainId: 1,
      },
      tamperingSigner,
    );
  } catch (error) {
    tamperError = error;
  }

  check(
    "swapping the recipient after validation is rejected",
    tamperError instanceof TransactionValidationError &&
      tamperError.code === "INVALID_DATA",
    tamperError instanceof TransactionValidationError
      ? tamperError.code
      : "no error was thrown",
  );

  const delegationSigner: WalletSigner = {
    async getAddress() {
      return generated.address;
    },

    async signMessage(message) {
      return signer.signMessage(message);
    },

    async signTransaction(transaction) {
      const walletAccount = mnemonicToAccount(generated.mnemonic);

      if (!walletAccount.signAuthorization) {
        throw new Error("viem build without EIP-7702 support");
      }

      const authorization = await walletAccount.signAuthorization({
        address: "0x000000000000000000000000000000000000dEaD",
        chainId: transaction.chainId,
        nonce: transaction.nonce + 1,
      });

      return walletAccount.signTransaction({
        type: "eip7702",
        chainId: transaction.chainId,
        to: transaction.to,
        value: transaction.value,
        nonce: transaction.nonce,
        gas: transaction.gas,
        maxFeePerGas: transaction.maxFeePerGas,
        maxPriorityFeePerGas: transaction.maxPriorityFeePerGas,
        data: transaction.data,
        authorizationList: [authorization],
      });
    },
  };

  await expectRejected(
    "injected EOA delegation (EIP-7702) is rejected",
    prepared,
    delegationSigner,
    "authorization list",
  );

  const legacySigner = makeSigner(generated.mnemonic, (account, tx) =>
    account.signTransaction({
      type: "legacy",
      chainId: tx.chainId,
      to: tx.to,
      value: tx.value,
      nonce: tx.nonce,
      gas: tx.gas,
      gasPrice: tx.maxFeePerGas,
      data: tx.data,
    }),
  );

  await expectRejected(
    "transaction-type substitution (legacy) is rejected",
    prepared,
    legacySigner,
    "type",
  );

  const accessListSigner = makeSigner(generated.mnemonic, (account, tx) =>
    account.signTransaction({
      type: "eip1559",
      chainId: tx.chainId,
      to: tx.to,
      value: tx.value,
      nonce: tx.nonce,
      gas: tx.gas,
      maxFeePerGas: tx.maxFeePerGas,
      maxPriorityFeePerGas: tx.maxPriorityFeePerGas,
      data: tx.data,
      accessList: [
        {
          address: "0x000000000000000000000000000000000000bEEF",
          storageKeys: [],
        },
      ],
    }),
  );

  await expectRejected(
    "an injected access list is rejected",
    prepared,
    accessListSigner,
    "access list",
  );

  const trailingGarbageSigner = makeSigner(
    generated.mnemonic,
    async (account, tx) => {
      const honest = await account.signTransaction({
        type: "eip1559",
        chainId: tx.chainId,
        to: tx.to,
        value: tx.value,
        nonce: tx.nonce,
        gas: tx.gas,
        maxFeePerGas: tx.maxFeePerGas,
        maxPriorityFeePerGas: tx.maxPriorityFeePerGas,
        data: tx.data,
      });

      return `${honest}00` as `0x${string}`;
    },
  );

  await expectRejected(
    "non-canonical encoding is rejected",
    prepared,
    trailingGarbageSigner,
    "canonically encoded",
  );

  const malleableSigner = makeSigner(
    generated.mnemonic,
    async (account, tx) => {
      const honest = await account.signTransaction({
        type: "eip1559",
        chainId: tx.chainId,
        to: tx.to,
        value: tx.value,
        nonce: tx.nonce,
        gas: tx.gas,
        maxFeePerGas: tx.maxFeePerGas,
        maxPriorityFeePerGas: tx.maxPriorityFeePerGas,
        data: tx.data,
      });

      const parsedHonest = parseTransaction(honest);

      const order =
        0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;

      const flippedS = order - BigInt(parsedHonest.s ?? "0x0");

      const { r, s, v, yParity, ...unsigned } = parsedHonest;

      return serializeTransaction(unsigned, {
        r: r as `0x${string}`,
        s: `0x${flippedS.toString(16).padStart(64, "0")}` as `0x${string}`,
        yParity: yParity === 0 ? 1 : 0,
      });
    },
  );

  await expectRejected(
    "a high-s signature is rejected",
    prepared,
    malleableSigner,
    "high-s",
  );

  const zeroTipPayload = {
    ...prepared,
    maxPriorityFeePerGas: 0n,
  };

  grantTransactionAuthorization(zeroTipPayload, "zero-tip-token");

  let zeroTipSigned: string | null = null;

  try {
    zeroTipSigned = await signNativeTransfer(
      {
        transaction: zeroTipPayload,
        authorization: "zero-tip-token",
        expectedChainId: 1,
      },
      signer,
    );
  } catch (error) {
    zeroTipSigned = `error: ${(error as Error).message}`;
  }

  check(
    "a zero priority fee signs normally",
    typeof zeroTipSigned === "string" && zeroTipSigned.startsWith("0x02"),
    zeroTipSigned?.slice(0, 40),
  );

  const erc20Transfer = await prepareErc20Transfer(
    {
      kind: "erc20-transfer",
      chainId: 1,
      from: generated.address,
      token: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      recipient: "0x000000000000000000000000000000000000dEaD",
      amount: 1_000_000n,
      tokenSymbol: "USDC",
      tokenDecimals: 6,
    },
    { expectedChainId: 1, expectedFrom: generated.address },
    fakeErc20Client as never,
  );

  grantTransactionAuthorization(erc20Transfer, "erc20-token");

  const signedErc20 = await signErc20Transfer(
    {
      transaction: erc20Transfer,
      authorization: "erc20-token",
      expectedChainId: 1,
    },
    signer,
  );

  check(
    "an ERC-20 transfer signs (value = 0)",
    signedErc20.startsWith("0x02") && erc20Transfer.value === 0n,
    `${signedErc20.slice(0, 14)}…`,
  );

  const revoke = await prepareErc20Revoke(
    {
      kind: "erc20-revoke",
      chainId: 1,
      from: generated.address,
      token: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      spender: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
      tokenSymbol: "USDC",
      spenderName: "Permit2",
    },
    { expectedChainId: 1, expectedFrom: generated.address },
    fakeErc20Client as never,
  );

  grantTransactionAuthorization(revoke, "revoke-token");

  const signedRevoke = await signErc20Revoke(
    {
      transaction: revoke,
      authorization: "revoke-token",
      expectedChainId: 1,
    },
    signer,
  );

  check(
    "an approval revoke signs (value = 0)",
    signedRevoke.startsWith("0x02"),
    `${signedRevoke.slice(0, 14)}…`,
  );

  let impostorMessageError: unknown = null;

  try {
    await signMessage({ message: "hexagonal" }, impostorSigner);
  } catch (error) {
    impostorMessageError = error;
  }

  check(
    "a message signed by a foreign key is rejected",
    impostorMessageError instanceof TransactionValidationError &&
      impostorMessageError.code === "INVALID_FROM",
  );

  const pinStorage = createMemoryStorage();

  const sha256Hex = async (value: string) => {
    const digest = await webcrypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(value),
    );

    return [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  };

  const pinDeps = {
    storage: pinStorage,
    random: nodeRandom,
    hash: sha256Hex,
  };

  await createPin("123456", pinDeps);

  const goodPin = await verifyPin("123456", pinDeps);

  const badPin = await verifyPin("000000", pinDeps);

  check(
    "PIN: correct accepted, wrong rejected with a counter",
    goodPin.ok && !badPin.ok && badPin.reason === "invalid",
    !badPin.ok && badPin.reason === "invalid"
      ? `attempts left: ${badPin.attemptsLeft}`
      : "",
  );

  const storedVerifier = parsePinVerifier(
    await pinStorage.get("security.pin.verifier.v2"),
  );

  check(
    "a new PIN is stored as a scrypt verifier, not a single hash round",
    storedVerifier?.version === 2 &&
      storedVerifier.kdf === "scrypt" &&
      storedVerifier.N === 16384 &&
      storedVerifier.hash.length === 64 &&
      (await pinStorage.get("security.pin.hash.v1")) === null,
    `N=${storedVerifier?.version === 2 ? storedVerifier.N : "none"}`,
  );

  const legacyStorage = createMemoryStorage();

  const legacySalt = "00112233445566778899aabbccddeeff";

  await legacyStorage.set("security.pin.salt.v1", legacySalt);

  await legacyStorage.set(
    "security.pin.hash.v1",
    await sha256Hex(`${legacySalt}:654321`),
  );

  const legacyDeps = {
    storage: legacyStorage,
    random: nodeRandom,
    hash: sha256Hex,
  };

  const legacyWrong = await verifyPin("111111", legacyDeps);

  const legacyRight = await verifyPin("654321", legacyDeps);

  const migratedVerifier = parsePinVerifier(
    await legacyStorage.get("security.pin.verifier.v2"),
  );

  const afterMigration = await verifyPin("654321", {
    storage: legacyStorage,
    random: nodeRandom,
    hash: async () => {
      throw new Error("legacy hash must not be used after migration");
    },
  });

  check(
    "an old single-round PIN still opens the wallet and is upgraded in place",
    !legacyWrong.ok &&
      legacyRight.ok &&
      migratedVerifier?.version === 2 &&
      (await legacyStorage.get("security.pin.hash.v1")) === null &&
      afterMigration.ok,
    "verified, migrated, legacy keys dropped",
  );

  const halfMigrated = createMemoryStorage();

  await halfMigrated.set("security.pin.salt.v1", legacySalt);

  await halfMigrated.set(
    "security.pin.hash.v1",
    await sha256Hex(`${legacySalt}:654321`),
  );

  await createPin("654321", {
    storage: halfMigrated,
    random: nodeRandom,
    hash: sha256Hex,
  });

  await halfMigrated.set("security.pin.salt.v1", legacySalt);

  await halfMigrated.set(
    "security.pin.hash.v1",
    await sha256Hex(`${legacySalt}:654321`),
  );

  const healing = await verifyPin("654321", {
    storage: halfMigrated,
    random: nodeRandom,
    hash: sha256Hex,
  });

  check(
    "a legacy hash left behind by an interrupted upgrade is cleared on the next unlock",
    healing.ok &&
      (await halfMigrated.get("security.pin.hash.v1")) === null &&
      (await halfMigrated.get("security.pin.salt.v1")) === null,
    "cheap hash no longer sits next to the strong one",
  );

  const tamperedStorage = createMemoryStorage();

  await tamperedStorage.set(
    "security.pin.verifier.v2",
    JSON.stringify({
      version: 2,
      kdf: "scrypt",
      N: 1024,
      r: 8,
      p: 1,
      salt: "aa",
      hash: "bb",
    }),
  );

  const weakened = parsePinVerifier(
    await tamperedStorage.get("security.pin.verifier.v2"),
  );

  const brickedStorage = createMemoryStorage();

  await brickedStorage.set("security.pin.verifier.v2", "{not json");

  const brickedHasPin = await hasPin(brickedStorage);

  const emptyStorage = createMemoryStorage();

  await emptyStorage.set("security.pin.verifier.v2", "");

  const emptyHasPin = await hasPin(emptyStorage);

  const emptyVerify = await verifyPin("654321", {
    storage: emptyStorage,
    random: nodeRandom,
    hash: sha256Hex,
  });

  const brickedVerify = await verifyPin("654321", {
    storage: brickedStorage,
    random: nodeRandom,
    hash: sha256Hex,
  });

  check(
    "a weakened verifier is rejected instead of being trusted",
    weakened === null,
    weakened === null ? "rejected" : "accepted",
  );

  check(
    "an unreadable verifier locks the wallet instead of opening it without a PIN",
    brickedHasPin === true &&
      !brickedVerify.ok &&
      brickedVerify.reason === "unusable",
    `hasPin: ${brickedHasPin}, verify: ${brickedVerify.ok ? "opened" : brickedVerify.reason}`,
  );

  check(
    "an emptied verifier is treated as broken, not as a wallet without a PIN",
    emptyHasPin === true &&
      !emptyVerify.ok &&
      emptyVerify.reason === "unusable",
    `hasPin: ${emptyHasPin}, verify: ${emptyVerify.ok ? "opened" : emptyVerify.reason}`,
  );

  const leakStorage = createMemoryStorage();

  const leakSecrets = createMemorySecretStore();

  const leakEngine = createWalletEngine({
    storage: leakStorage,
    secrets: leakSecrets,
    random: nodeRandom,
  });

  const leakPhrase = (await leakEngine.prepare()).recoveryPhrase;

  await leakEngine.create(leakPhrase);

  await createPin("135790", {
    storage: leakStorage,
    random: nodeRandom,
    hash: sha256Hex,
  });

  const leakedValues: string[] = [];

  for (const key of [
    "security.pin.verifier.v2",
    "security.pin.failed-attempts.v1",
    "security.pin.blocked-until.v1",
    "wallet.registry.v1",
    "wallet.active.v1",
    "wallet.journal.v1",
  ]) {
    const value = await leakStorage.get(key);

    if (
      value &&
      (value.includes("135790") ||
        leakPhrase.split(" ").some((word) => value.includes(` ${word} `)) ||
        value.includes(leakPhrase))
    ) {
      leakedValues.push(key);
    }
  }

  check(
    "neither the PIN nor the recovery phrase is written to key-value storage",
    leakedValues.length === 0,
    leakedValues.length === 0 ? "6 keys inspected" : leakedValues.join(", "),
  );

  const stubSigner: WalletSigner = {
    async getAddress() {
      return generated.address;
    },

    async signMessage() {
      throw new Error("stub signer must never be reached");
    },

    async signTransaction() {
      throw new Error("stub signer must never be reached");
    },
  };

  const { lockSession } = await import("@/core/security/sessionLock");

  lockSession();

  grantTransactionAuthorization(prepared, "second-token");

  let lockError: unknown = null;

  try {
    await signNativeTransfer(
      {
        transaction: prepared,
        authorization: "second-token",
        expectedChainId: 1,
      },
      stubSigner,
    );
  } catch (error) {
    lockError = error;
  }

  check(
    "the lock holds transaction signing inside the domain itself",
    lockError instanceof WalletLockedError,
    lockError instanceof Error ? lockError.name : "no error was thrown",
  );

  let lockedMessage: unknown = null;

  try {
    await signMessage({ message: "locked" }, stubSigner);
  } catch (error) {
    lockedMessage = error;
  }

  check(
    "the lock holds message signing inside the domain itself",
    lockedMessage instanceof WalletLockedError,
    lockedMessage instanceof Error ? lockedMessage.name : "no error was thrown",
  );

  const policy: SecurityPolicy = {
    version: 1,
    maxSingleTransferUsd: 5000,
    newRecipientMaxUsd: 300,
    dailyOutflowLimitUsd: 10000,
      maxApprovalExposureUsd: null,
      blockUnlimitedApprovals: true,
      blockUnknownSpenders: true,
      maxSwapLossUsd: null,
  };

  const knownRecipient = "0x000000000000000000000000000000000000dEaD";

  const context = buildPolicyContext({
    owner: generated.address,
    activity: [
      {
        id: "a1",
        hash: "0x00",
        status: "confirmed",
        direction: "sent",
        assetType: "native",
        symbol: "ETH",
        amount: "1",
        from: generated.address,
        to: knownRecipient,
        contractAddress: null,
        blockNumber: null,
        timestamp: Date.now() - 86_400_000,
      },
    ] as never,
    tracked: [
      {
        version: 1,
        hash: "0x01",
        chainId: 1,
        walletId: created.account.id,
        from: generated.address,
        to: knownRecipient,
        assetType: "native",
        symbol: "ETH",
        valueWei: (10n ** 18n).toString(),
        createdAt: Date.now() - 3_600_000,
        status: "confirmed",
        blockNumber: null,
        gasUsed: null,
        gasLimit: "200000",
        route: "Uniswap V3, direct pool",
        effectiveGasPriceWei: null,
        confirmedAt: null,
      },
    ] as never,
    priceOf: (symbol) => (symbol === "ETH" ? 2000 : null),
  });

  check(
    "policy context: known recipient and daily outflow",
    context.knownRecipients.includes(knownRecipient.toLowerCase()) &&
      context.spentTodayUsd === 2000,
    `sent today $${context.spentTodayUsd}`,
  );

  const overSingle = evaluateSecurityPolicy(
    { recipient: knownRecipient, amountUsd: 6000 },
    policy,
    context,
  );

  check(
    "the single-transaction limit fires",
    !overSingle.allowed && overSingle.rule === "max-single-transfer",
  );

  const newRecipientVerdict = evaluateSecurityPolicy(
    { recipient: "0x00000000000000000000000000000000000000Ff", amountUsd: 400 },
    policy,
    context,
  );

  check(
    "the first transfer to a new address is capped",
    !newRecipientVerdict.allowed && newRecipientVerdict.rule === "new-recipient",
  );

  const dailyVerdict = evaluateSecurityPolicy(
    { recipient: knownRecipient, amountUsd: 4000 },
    policy,
    { ...context, spentTodayUsd: 9000 },
  );

  check(
    "the daily limit fires",
    !dailyVerdict.allowed && dailyVerdict.rule === "daily-outflow",
  );

  check(
    "a known recipient within limits is allowed",
    evaluateSecurityPolicy(
      { recipient: knownRecipient, amountUsd: 250 },
      policy,
      context,
    ).allowed,
  );

  const noPriceVerdict = evaluateSecurityPolicy(
    { recipient: "0x00000000000000000000000000000000000000Ff", amountUsd: null },
    policy,
    context,
  );

  check(
    "an asset with no price does not slip past enabled limits",
    !noPriceVerdict.allowed,
    noPriceVerdict.allowed ? "" : noPriceVerdict.message.slice(0, 40) + "…",
  );

  check(
    "with no limits an asset without a price sends freely",
    evaluateSecurityPolicy(
      { recipient: "0x00000000000000000000000000000000000000Ff", amountUsd: null },
      {
        version: 1,
        maxSingleTransferUsd: null,
        newRecipientMaxUsd: null,
        dailyOutflowLimitUsd: null,
        maxApprovalExposureUsd: null,
        blockUnlimitedApprovals: true,
        blockUnknownSpenders: true,
        maxSwapLossUsd: null,
      },
      context,
    ).allowed,
  );

  check(
    "the policy survives serialization",
    parseSecurityPolicy(serializeSecurityPolicy(policy)).maxSingleTransferUsd ===
      5000 && parseSecurityPolicy("garbage").maxSingleTransferUsd === null,
  );

  const strictPolicy: SecurityPolicy = {
    version: 1,
    maxSingleTransferUsd: 1000,
    newRecipientMaxUsd: null,
    dailyOutflowLimitUsd: null,
      maxApprovalExposureUsd: null,
      blockUnlimitedApprovals: true,
      blockUnknownSpenders: true,
      maxSwapLossUsd: null,
  };

  const stranger = "0x00000000000000000000000000000000000000Ff" as const;

  const overLimit = decidePolicy({
    intent: { kind: "transfer", recipient: stranger, amountUsd: 4000 },
    policy: strictPolicy,
    context,
    networkKind: "mainnet",
    priceAvailability: "available",
  });

  check(
    "decidePolicy blocks an over-limit transfer on mainnet",
    overLimit.decision === "block" &&
      overLimit.enforcement === "enforced" &&
      overLimit.reason === "over-single-transfer",
    `${overLimit.reason}/${overLimit.enforcement}`,
  );

  const underLimit = decidePolicy({
    intent: { kind: "transfer", recipient: stranger, amountUsd: 100 },
    policy: strictPolicy,
    context,
    networkKind: "mainnet",
    priceAvailability: "available",
  });

  check(
    "decidePolicy allows an under-limit transfer and says it enforced",
    underLimit.decision === "allow" &&
      underLimit.enforcement === "enforced" &&
      underLimit.reason === "within-limits",
    `${underLimit.reason}/${underLimit.enforcement}`,
  );

  const testnetTransfer = decidePolicy({
    intent: { kind: "transfer", recipient: stranger, amountUsd: 4000 },
    policy: strictPolicy,
    context,
    networkKind: "testnet",
    priceAvailability: "available",
  });

  check(
    "a testnet transfer is not silently allowed but marked not-applicable",
    testnetTransfer.decision === "uncovered" &&
      testnetTransfer.enforcement === "not-applicable" &&
      testnetTransfer.reason === "usd-policy-disabled-on-testnet",
    `${testnetTransfer.reason}/${testnetTransfer.enforcement}`,
  );

  const missingPrice = decidePolicy({
    intent: { kind: "transfer", recipient: stranger, amountUsd: null },
    policy: strictPolicy,
    context,
    networkKind: "mainnet",
    priceAvailability: "unavailable",
  });

  check(
    "an unpriced asset on mainnet is blocked, not waved through",
    missingPrice.decision === "block" &&
      missingPrice.enforcement === "unavailable" &&
      missingPrice.reason === "price-unavailable",
    `${missingPrice.reason}/${missingPrice.enforcement}`,
  );

  const staleFigure = decidePolicy({
    intent: { kind: "transfer", recipient: stranger, amountUsd: 100 },
    policy: strictPolicy,
    context,
    networkKind: "mainnet",
    priceAvailability: "unavailable",
  });

  check(
    "a stale dollar figure is not trusted once the price is unavailable",
    staleFigure.decision === "block" &&
      staleFigure.enforcement === "unavailable" &&
      staleFigure.reason === "price-unavailable",
    `${staleFigure.reason}/${staleFigure.enforcement}`,
  );

  check(
    "a zero price counts as no price, not as a free pass",
    toAmountUsd("1", 0) === null &&
      toAmountUsd("1", null) === null &&
      toAmountUsd("1", Number.NaN) === null &&
      toAmountUsd("1", -5) === null,
  );

  check(
    "a usable price converts the amount, and junk input does not",
    toAmountUsd("2", 4000) === 8000 &&
      toAmountUsd("abc", 4000) === null &&
      toAmountUsd("-1", 4000) === null,
  );

  const blockingDecisions = [
    decidePolicy({
      intent: { kind: "transfer", recipient: stranger, amountUsd: 4000 },
      policy: strictPolicy,
      context,
      networkKind: "mainnet",
      priceAvailability: "available",
    }),
    decidePolicy({
      intent: { kind: "transfer", recipient: stranger, amountUsd: null },
      policy: strictPolicy,
      context,
      networkKind: "mainnet",
      priceAvailability: "unavailable",
    }),
    decidePolicy({
      intent: { kind: "transfer", recipient: stranger, amountUsd: 100 },
      policy: strictPolicy,
      context: null,
      networkKind: "mainnet",
      priceAvailability: "available",
    }),
  ];

  check(
    "every blocking decision carries a message the screen can show",
    blockingDecisions.every(
      (item) =>
        item.decision === "block" &&
        typeof item.message === "string" &&
        item.message.length > 0,
    ),
    `${blockingDecisions.length} block paths checked`,
  );

  const noHistory = decidePolicy({
    intent: { kind: "transfer", recipient: stranger, amountUsd: 100 },
    policy: strictPolicy,
    context: null,
    networkKind: "mainnet",
    priceAvailability: "available",
  });

  check(
    "unreachable history blocks the transfer instead of skipping the check",
    noHistory.decision === "block" &&
      noHistory.enforcement === "unavailable" &&
      noHistory.reason === "history-unavailable",
    `${noHistory.reason}/${noHistory.enforcement}`,
  );

  const guardedPolicy: SecurityPolicy = {
    ...strictPolicy,
    maxApprovalExposureUsd: 500,
    maxSwapLossUsd: 100,
  };

  const approve = (
    overrides: Partial<Extract<PolicyIntent, { kind: "approval" }>> = {},
    policy: SecurityPolicy = guardedPolicy,
  ) =>
    decidePolicy({
      intent: {
        kind: "approval",
        spender: stranger,
        spenderKnown: true,
        unlimited: false,
        revoking: false,
        exposureUsd: 100,
        ...overrides,
      },
      policy,
      context,
      networkKind: "mainnet",
      priceAvailability: "available",
    });

  check(
    "an unlimited approval is refused outright",
    approve({ unlimited: true }).decision === "block" &&
      approve({ unlimited: true }).reason === "approval-unlimited",
    approve({ unlimited: true }).reason,
  );

  check(
    "a contract the wallet does not recognise cannot be given permission",
    approve({ spenderKnown: false }).decision === "block" &&
      approve({ spenderKnown: false }).reason === "approval-unknown-spender",
    approve({ spenderKnown: false }).reason,
  );

  check(
    "an approval worth more than the limit is refused, a smaller one passes",
    approve({ exposureUsd: 900 }).decision === "block" &&
      approve({ exposureUsd: 900 }).reason === "approval-over-exposure" &&
      approve({ exposureUsd: 100 }).decision === "allow",
    `${approve({ exposureUsd: 900 }).reason} at $900, allow at $100`,
  );

  check(
    "taking permission away is never blocked, whatever the limits say",
    approve({ revoking: true, unlimited: true, spenderKnown: false })
      .decision === "uncovered" &&
      approve({ revoking: true, unlimited: true, spenderKnown: false })
        .reason === "approval-revokes-access",
    "revoking is always allowed through",
  );

  check(
    "an approval on a token with no price is refused while the limit is on",
    approve({ exposureUsd: null }).decision === "block" &&
      approve({ exposureUsd: null }).reason === "price-unavailable" &&
      approve({ exposureUsd: null }, strictPolicy).decision === "allow",
    "fail-closed only while the approval limit is set",
  );

  const swapIntent = (
    overrides: Partial<Extract<PolicyIntent, { kind: "swap" }>> = {},
    policy: SecurityPolicy = guardedPolicy,
  ) =>
    decidePolicy({
      intent: { kind: "swap", lossUsd: 10, ...overrides },
      policy,
      context,
      networkKind: "mainnet",
      priceAvailability: "available",
    });

  check(
    "a swap whose worst case loses more than the limit is refused",
    swapIntent({ lossUsd: 400 }).decision === "block" &&
      swapIntent({ lossUsd: 400 }).reason === "swap-over-loss" &&
      swapIntent({ lossUsd: 10 }).decision === "allow",
    swapIntent({ lossUsd: 400 }).reason,
  );

  check(
    "a swap priced on one side only is refused while the loss limit is on",
    swapIntent({ lossUsd: null }).decision === "block" &&
      swapIntent({ lossUsd: null }).reason === "price-unavailable" &&
      swapIntent({ lossUsd: null }, strictPolicy).decision === "allow",
    "fail-closed only while the swap limit is set",
  );

  const unconfigured = decidePolicy({
    intent: { kind: "transfer", recipient: stranger, amountUsd: 999_999 },
    policy: {
      version: 1,
      maxSingleTransferUsd: null,
      newRecipientMaxUsd: null,
      dailyOutflowLimitUsd: null,
      maxApprovalExposureUsd: null,
      blockUnlimitedApprovals: true,
      blockUnknownSpenders: true,
      maxSwapLossUsd: null,
    },
    context,
    networkKind: "mainnet",
    priceAvailability: "available",
  });

  check(
    "with no limits configured the pass is labelled not-applicable",
    unconfigured.decision === "uncovered" &&
      unconfigured.enforcement === "not-applicable" &&
      unconfigured.reason === "no-limits-configured",
    `${unconfigured.reason}/${unconfigured.enforcement}`,
  );

  check(
    "an expired Permit2 approval is treated as dead",
    isPermit2Expired(Math.floor(Date.now() / 1000) - 10) &&
      !isPermit2Expired(Math.floor(Date.now() / 1000) + 3600),
  );

  check(
    "Permit2 revoke calldata is approve(token, spender, 0, 0)",
    encodePermit2Revoke(
      "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD",
    ).startsWith("0x87517c45"),
  );

  check(
    "Permit2 unlimited is uint160 max",
    PERMIT2_UNLIMITED === 2n ** 160n - 1n,
  );

  check(
    "risk grows from money at risk, not from the approval size",
    scoreApproval({ unlimited: true, exposureUsd: 5000, spenderKnown: true }) ===
      "critical" &&
      scoreApproval({
        unlimited: true,
        exposureUsd: 0,
        spenderKnown: true,
      }) === "medium" &&
      scoreApproval({
        unlimited: false,
        exposureUsd: 10,
        spenderKnown: true,
      }) === "medium" &&
      scoreApproval({
        unlimited: false,
        exposureUsd: 10,
        spenderKnown: false,
      }) === "critical",
  );

  check(
    "an unlimited approval to an unknown spender is critical even at zero or unknown current exposure",
    scoreApproval({
      unlimited: true,
      exposureUsd: 0,
      spenderKnown: false,
    }) === "critical" &&
      scoreApproval({
        unlimited: true,
        exposureUsd: null,
        spenderKnown: false,
        holdsTokens: false,
      }) === "critical" &&
      scoreApproval({
        unlimited: true,
        exposureUsd: null,
        spenderKnown: false,
        holdsTokens: true,
      }) === "critical",
    "a standing unlimited authorization to an unknown contract is never downgraded by a $0 or empty balance",
  );

  const lifecycleStorage = createMemoryStorage();

  const lifecycleSecrets = createMemorySecretStore();

  const lifecycleEngine = createWalletEngine({
    storage: lifecycleStorage,
    secrets: lifecycleSecrets,
    random: nodeRandom,
  });

  const first = await lifecycleEngine.prepare();

  const firstAccount = await lifecycleEngine.create(first.recoveryPhrase);

  const second = await lifecycleEngine.prepare();

  const secondAccount = await lifecycleEngine.create(second.recoveryPhrase);

  await lifecycleEngine.remove(firstAccount.id);

  const afterRemoval = await lifecycleEngine.list();

  const activeAfterRemoval = await lifecycleEngine.getActive();

  check(
    "removal leaves no record without its secret",
    afterRemoval.length === 1 &&
      afterRemoval[0].id === secondAccount.id &&
      (await lifecycleSecrets.load(firstAccount.id)) === null &&
      (await lifecycleSecrets.load(secondAccount.id)) !== null &&
      activeAfterRemoval?.id === secondAccount.id,
  );

  await lifecycleSecrets.remove(secondAccount.id);

  await lifecycleEngine.importFromMnemonic(second.recoveryPhrase);

  check(
    "re-import restores a lost secret",
    (await lifecycleSecrets.load(secondAccount.id))?.mnemonic ===
      second.recoveryPhrase,
  );

  const failingStorage = createMemoryStorage();

  const failingSecrets = createMemorySecretStore();

  const failingEngine = createWalletEngine({
    storage: failingStorage,
    secrets: failingSecrets,
    random: nodeRandom,
  });

  const doomed = await failingEngine.prepare();

  const doomedAccount = await failingEngine.create(doomed.recoveryPhrase);

  const originalSet = failingStorage.set.bind(failingStorage);

  failingStorage.set = async (key: string, value: string) => {
    if (key.includes("registry")) {
      throw new Error("storage failure");
    }

    return originalSet(key, value);
  };

  try {
    await failingEngine.remove(doomedAccount.id);
  } catch {
  }

  failingStorage.set = originalSet;

  const survivors = await failingEngine.list();

  const secretsIntact = await Promise.all(
    survivors.map(async (wallet) => (await failingSecrets.load(wallet.id)) !== null),
  );

  check(
    "a failure during removal leaves no wallet without its secret",
    secretsIntact.every(Boolean),
    `in registry ${survivors.length}, secrets intact: ${secretsIntact.every(Boolean)}`,
  );

  type CrashStores = {
    kv: Map<string, string>;
    sec: Map<string, WalletSecret>;
    storage: KeyValueStorage;
    secrets: SecretStore;
    writes: () => number;
  };

  function createCrashStores(failAtWrite: number | null): CrashStores {
    const kv = new Map<string, string>();

    const sec = new Map<string, WalletSecret>();

    let writes = 0;

    function bump() {
      writes += 1;

      if (failAtWrite !== null && writes === failAtWrite) {
        throw new Error("device died mid-write");
      }
    }

    return {
      kv,
      sec,
      writes: () => writes,

      storage: {
        async get(key) {
          return kv.get(key) ?? null;
        },
        async set(key, value) {
          bump();
          kv.set(key, value);
        },
        async remove(key) {
          bump();
          kv.delete(key);
        },
      },

      secrets: {
        async load(walletId) {
          return sec.get(walletId) ?? null;
        },
        async save(walletId, secret) {
          bump();
          sec.set(walletId, secret);
          return { durable: true };
        },
        async remove(walletId) {
          bump();
          sec.delete(walletId);
        },
      },
    };
  }

  function inspectState(stores: CrashStores) {
    const registry = JSON.parse(
      stores.kv.get("wallet.registry.v1") ?? "[]",
    ) as WalletAccountShape[];

    const ids = registry.map((wallet) => wallet.id);

    const secretIds = [...stores.sec.keys()];

    const active = stores.kv.get("wallet.active.v1") ?? null;

    return {
      orphanSecrets: secretIds.filter((id) => !ids.includes(id)),

      entriesWithoutSecret: ids.filter((id) => !secretIds.includes(id)),

      activeDangling:
        registry.length === 0
          ? active !== null
          : active !== null && !ids.includes(active),

      journalLeft: stores.kv.has("wallet.journal.v1"),

      size: registry.length,
    };
  }

  const crashPhrase = (await createWalletEngine({
    storage: createMemoryStorage(),
    secrets: createMemorySecretStore(),
    random: nodeRandom,
  }).prepare()).recoveryPhrase;

  const createBreakages: string[] = [];

  for (let failAt = 1; failAt <= 8; failAt++) {
    const stores = createCrashStores(failAt);

    const dying = createWalletEngine({
      storage: stores.storage,
      secrets: stores.secrets,
      random: nodeRandom,
    });

    try {
      await dying.create(crashPhrase);
    } catch {
      void 0;
    }

    const revived = createWalletEngine({
      storage: { ...stores.storage },
      secrets: { ...stores.secrets },
      random: nodeRandom,
    });

    await revived.initialize();

    const state = inspectState(stores);

    if (
      state.orphanSecrets.length > 0 ||
      state.entriesWithoutSecret.length > 0 ||
      state.activeDangling ||
      state.journalLeft
    ) {
      createBreakages.push(
        `create@${failAt}: orphans=${state.orphanSecrets.length} zombies=${state.entriesWithoutSecret.length} dangling=${state.activeDangling} journal=${state.journalLeft}`,
      );
    }
  }

  check(
    "killing the app after any single write during create always reconciles",
    createBreakages.length === 0,
    createBreakages[0] ?? "8 crash points swept",
  );

  const removeBreakages: string[] = [];

  for (let failAt = 1; failAt <= 8; failAt++) {
    const stores = createCrashStores(null);

    const seeded = createWalletEngine({
      storage: stores.storage,
      secrets: stores.secrets,
      random: nodeRandom,
    });

    const victim = await seeded.create(crashPhrase);

    let counter = 0;

    const armed = createWalletEngine({
      storage: {
        async get(key) {
          return stores.storage.get(key);
        },
        async set(key, value) {
          counter += 1;
          if (counter === failAt) throw new Error("device died mid-write");
          return stores.storage.set(key, value);
        },
        async remove(key) {
          counter += 1;
          if (counter === failAt) throw new Error("device died mid-write");
          return stores.storage.remove(key);
        },
      },
      secrets: {
        async load(walletId) {
          return stores.secrets.load(walletId);
        },
        async save(walletId, secret) {
          counter += 1;
          if (counter === failAt) throw new Error("device died mid-write");
          return stores.secrets.save(walletId, secret);
        },
        async remove(walletId) {
          counter += 1;
          if (counter === failAt) throw new Error("device died mid-write");
          return stores.secrets.remove(walletId);
        },
      },
      random: nodeRandom,
    });

    try {
      await armed.remove(victim.id);
    } catch {
      void 0;
    }

    const revived = createWalletEngine({
      storage: stores.storage,
      secrets: stores.secrets,
      random: nodeRandom,
    });

    await revived.initialize();

    const state = inspectState(stores);

    if (
      state.orphanSecrets.length > 0 ||
      state.entriesWithoutSecret.length > 0 ||
      state.activeDangling ||
      state.journalLeft
    ) {
      removeBreakages.push(
        `remove@${failAt}: orphans=${state.orphanSecrets.length} zombies=${state.entriesWithoutSecret.length} dangling=${state.activeDangling} journal=${state.journalLeft}`,
      );
    }
  }

  check(
    "killing the app after any single write during remove always reconciles",
    removeBreakages.length === 0,
    removeBreakages[0] ?? "8 crash points swept",
  );

  const raceStores = createCrashStores(null);

  const raceEngine = createWalletEngine({
    storage: raceStores.storage,
    secrets: raceStores.secrets,
    random: nodeRandom,
  });

  const firstPhrase = (await raceEngine.prepare()).recoveryPhrase;

  const secondPhrase = (await raceEngine.prepare()).recoveryPhrase;

  await Promise.all([
    raceEngine.create(firstPhrase),
    raceEngine.create(secondPhrase),
  ]);

  const raceState = inspectState(raceStores);

  check(
    "two concurrent creates do not lose a wallet to read-modify-write",
    raceState.size === 2 &&
      raceState.orphanSecrets.length === 0 &&
      raceState.entriesWithoutSecret.length === 0,
    `registry ${raceState.size}, orphans ${raceState.orphanSecrets.length}`,
  );

  const interleaveStores = createCrashStores(null);

  const yieldTurn = () => new Promise((resolve) => setTimeout(resolve, 1));

  const slowStorage: KeyValueStorage = {
    async get(key) {
      await yieldTurn();

      return interleaveStores.storage.get(key);
    },
    async set(key, value) {
      await yieldTurn();

      return interleaveStores.storage.set(key, value);
    },
    async remove(key) {
      await yieldTurn();

      return interleaveStores.storage.remove(key);
    },
  };

  const interleaveEngine = createWalletEngine({
    storage: slowStorage,
    secrets: interleaveStores.secrets,
    random: nodeRandom,
  });

  const doomedWallet = await interleaveEngine.create(
    (await interleaveEngine.prepare()).recoveryPhrase,
  );

  const keptWallet = await interleaveEngine.create(
    (await interleaveEngine.prepare()).recoveryPhrase,
  );

  interleaveStores.kv.set("wallet.active.v1", "0xghost");

  const [, activeDuringRemoval] = await Promise.all([
    interleaveEngine.remove(doomedWallet.id),
    interleaveEngine.getActive(),
  ]);

  const interleaved = inspectState(interleaveStores);

  check(
    "reading the active wallet while another is being removed cannot point at a ghost",
    !interleaved.activeDangling &&
      interleaved.orphanSecrets.length === 0 &&
      activeDuringRemoval?.id === keptWallet.id,
    `dangling: ${interleaved.activeDangling}, returned: ${
      activeDuringRemoval?.id === doomedWallet.id ? "removed wallet" : "kept"
    }`,
  );

  const rollbackStores = createCrashStores(null);

  const rollbackEngine = createWalletEngine({
    storage: rollbackStores.storage,
    secrets: rollbackStores.secrets,
    random: nodeRandom,
  });

  const survivor = await rollbackEngine.create(
    (await rollbackEngine.prepare()).recoveryPhrase,
  );

  const bystander = await rollbackEngine.create(
    (await rollbackEngine.prepare()).recoveryPhrase,
  );

  rollbackStores.kv.set(
    "wallet.journal.v1",
    JSON.stringify({
      op: "remove",
      walletId: survivor.id,
      address: survivor.address,
      name: survivor.name,
      before: [survivor.id, bystander.id].map((id) => id.toLowerCase()).sort().join(","),
      after: [bystander.id.toLowerCase()].join(","),
    }),
  );

  const thirdWallet = await createWalletEngine({
    storage: rollbackStores.storage,
    secrets: rollbackStores.secrets,
    random: nodeRandom,
  }).prepare();

  const registryNow = JSON.parse(
    rollbackStores.kv.get("wallet.registry.v1") ?? "[]",
  ) as WalletAccountShape[];

  rollbackStores.kv.set(
    "wallet.registry.v1",
    JSON.stringify([
      ...registryNow,
      {
        id: thirdWallet.address.toLowerCase(),
        name: "Wallet 3",
        address: thirdWallet.address,
      },
    ]),
  );

  await createWalletEngine({
    storage: rollbackStores.storage,
    secrets: rollbackStores.secrets,
    random: nodeRandom,
  }).initialize();

  const survivorSecret = await rollbackStores.secrets.load(survivor.id);

  const registryAfterRollback = JSON.parse(
    rollbackStores.kv.get("wallet.registry.v1") ?? "[]",
  ) as WalletAccountShape[];

  check(
    "a journal written against a state that moved on does not delete a live wallet",
    survivorSecret !== null &&
      registryAfterRollback.some((wallet) => wallet.id === survivor.id) &&
      !rollbackStores.kv.has("wallet.journal.v1"),
    survivorSecret === null ? "secret was destroyed" : "secret kept, journal cleared",
  );

  const staleStores = createCrashStores(null);

  const staleEngine = createWalletEngine({
    storage: staleStores.storage,
    secrets: staleStores.secrets,
    random: nodeRandom,
  });

  const staleVictim = await staleEngine.create(
    (await staleEngine.prepare()).recoveryPhrase,
  );

  const staleCompanion = await staleEngine.create(
    (await staleEngine.prepare()).recoveryPhrase,
  );

  staleStores.kv.set(
    "wallet.journal.v1",
    JSON.stringify({
      op: "remove",
      walletId: staleVictim.id,
      address: staleVictim.address,
      name: staleVictim.name,
      before: [staleVictim.id, staleCompanion.id]
        .map((id) => id.toLowerCase())
        .sort()
        .join(","),
      after: staleCompanion.id.toLowerCase(),
      writtenAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
    }),
  );

  await createWalletEngine({
    storage: staleStores.storage,
    secrets: staleStores.secrets,
    random: nodeRandom,
  }).initialize();

  check(
    "a journal older than the trust window is not replayed against a wallet the user kept using",
    (await staleStores.secrets.load(staleVictim.id)) !== null &&
      !staleStores.kv.has("wallet.journal.v1"),
    (await staleStores.secrets.load(staleVictim.id)) === null
      ? "secret was destroyed"
      : "secret kept",
  );

  const MAINNET = "eth-mainnet";

  const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3";

  const ROUTER = "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45";

  const UNIVERSAL = "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD";

  const directSpenders = getKnownSpenders(MAINNET);

  const permit2Spenders = getPermit2Spenders(MAINNET);

  function approvalsClient(options: {
    token: Address;
    direct: Record<string, bigint>;
    permit2?: Record<string, { amount: bigint; expiration: number }>;
  }) {
    return {
      async multicall({ contracts }: { contracts: { address: string; args: readonly unknown[] }[] }) {
        return contracts.map((call) => {
          if (call.address.toLowerCase() === PERMIT2.toLowerCase()) {
            const spender = String(call.args[2]).toLowerCase();

            const entry = options.permit2?.[spender];

            return entry
              ? {
                  status: "success" as const,
                  result: [entry.amount, entry.expiration, 0] as const,
                }
              : { status: "success" as const, result: [0n, 0, 0] as const };
          }

          const spender = String(call.args[1]).toLowerCase();

          return {
            status: "success" as const,
            result: options.direct[spender] ?? 0n,
          };
        });
      },
    } as unknown as Parameters<typeof getApprovals>[3];
  }

  const usdc = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as Address;

  function usdcAsset(balance: string, priceUsd: number | null = 1) {
    return {
      type: "erc20" as const,
      symbol: "USDC",
      name: "USD Coin",
      balance,
      decimals: 6,
      decimalsKnown: true,
      priceUsd,
      valueUsd: priceUsd === null ? null : Number(balance) * priceUsd,
      logo: null,
      contractAddress: usdc,
    };
  }

  const future = Math.floor(Date.now() / 1000) + 86_400;

  const twoSpenders = await getApprovals(
    generated.address,
    [usdcAsset("10000")],
    MAINNET,
    approvalsClient({
      token: usdc,
      direct: {
        [ROUTER.toLowerCase()]: 8_000_000_000n,
        [UNIVERSAL.toLowerCase()]: 8_000_000_000n,
      },
    }),
  );

  check(
    "two spenders draining in turn can take the whole balance, and the total says so",
    twoSpenders.approvals.length === 2 &&
      twoSpenders.totalExposureUsd === 10000,
    `exposure $${twoSpenders.totalExposureUsd} on a $10000 balance`,
  );

  check(
    "each approval row names the spender it belongs to",
    twoSpenders.approvals.some(
      (row) => row.spender.toLowerCase() === ROUTER.toLowerCase(),
    ) &&
      twoSpenders.approvals.some(
        (row) => row.spender.toLowerCase() === UNIVERSAL.toLowerCase(),
      ) &&
      twoSpenders.approvals.every((row) => row.id.includes(row.spender.toLowerCase())),
    twoSpenders.approvals.map((row) => row.spenderName).join(" + "),
  );

  const halfEach = await getApprovals(
    generated.address,
    [usdcAsset("10000")],
    MAINNET,
    approvalsClient({
      token: usdc,
      direct: {
        [ROUTER.toLowerCase()]: 3_000_000_000n,
        [UNIVERSAL.toLowerCase()]: 2_000_000_000n,
      },
    }),
  );

  check(
    "partial allowances add up instead of collapsing to the largest one",
    halfEach.totalExposureUsd === 5000,
    `exposure $${halfEach.totalExposureUsd} (3000 + 2000)`,
  );

  const bothChannels = await getApprovals(
    generated.address,
    [usdcAsset("10000")],
    MAINNET,
    approvalsClient({
      token: usdc,
      direct: {
        [ROUTER.toLowerCase()]: 10_000_000_000n,
        [PERMIT2.toLowerCase()]: 10_000_000_000n,
      },
      permit2: {
        [UNIVERSAL.toLowerCase()]: { amount: 10_000_000_000n, expiration: future },
      },
    }),
  );

  check(
    "the same balance is never counted twice across channels",
    bothChannels.totalExposureUsd === 10000,
    `exposure $${bothChannels.totalExposureUsd} across ${bothChannels.approvals.length} approvals`,
  );

  const expired = await getApprovals(
    generated.address,
    [usdcAsset("10000")],
    MAINNET,
    approvalsClient({
      token: usdc,
      direct: { [PERMIT2.toLowerCase()]: 10_000_000_000n },
      permit2: {
        [UNIVERSAL.toLowerCase()]: {
          amount: 10_000_000_000n,
          expiration: Math.floor(Date.now() / 1000) - 60,
        },
      },
    }),
  );

  check(
    "an expired Permit2 permission counts as dead, not as exposure",
    expired.expiredCount === 1 &&
      expired.approvals.every((item) => item.channel !== "permit2"),
    `expired ${expired.expiredCount}`,
  );

  const cappedByBudget = await getApprovals(
    generated.address,
    [usdcAsset("10000")],
    MAINNET,
    approvalsClient({
      token: usdc,
      direct: { [PERMIT2.toLowerCase()]: 100_000_000n },
      permit2: {
        [UNIVERSAL.toLowerCase()]: { amount: 9_000_000_000n, expiration: future },
      },
    }),
  );

  const permit2Row = cappedByBudget.approvals.find(
    (item) => item.channel === "permit2",
  );

  check(
    "a Permit2 permission larger than its ERC-20 budget is capped by the budget",
    permit2Row?.exposureUsd === 100 && cappedByBudget.totalExposureUsd === 100,
    `row $${permit2Row?.exposureUsd}, total $${cappedByBudget.totalExposureUsd}`,
  );

  const overBalance = await getApprovals(
    generated.address,
    [usdcAsset("250")],
    MAINNET,
    approvalsClient({
      token: usdc,
      direct: { [ROUTER.toLowerCase()]: 999_999_000_000n },
    }),
  );

  check(
    "an allowance larger than the balance cannot risk more than the balance",
    overBalance.totalExposureUsd === 250,
    `exposure $${overBalance.totalExposureUsd}`,
  );

  const budgetOnly = await getApprovals(
    generated.address,
    [usdcAsset("10000")],
    MAINNET,
    approvalsClient({
      token: usdc,
      direct: { [PERMIT2.toLowerCase()]: 10_000_000_000n },
    }),
  );

  check(
    "a live Permit2 budget with no permissions yet is still counted as money at risk",
    budgetOnly.totalExposureUsd === 10000 &&
      budgetOnly.approvals[0]?.exposureUsd === 10000,
    `total $${budgetOnly.totalExposureUsd}, row $${budgetOnly.approvals[0]?.exposureUsd}`,
  );

  const crossChannel = await getApprovals(
    generated.address,
    [usdcAsset("10000")],
    MAINNET,
    approvalsClient({
      token: usdc,
      direct: {
        [ROUTER.toLowerCase()]: 4_000_000_000n,
        [PERMIT2.toLowerCase()]: 3_000_000_000n,
      },
      permit2: {
        [UNIVERSAL.toLowerCase()]: { amount: 3_000_000_000n, expiration: future },
      },
    }),
  );

  check(
    "a router allowance and a Permit2 budget add up instead of one hiding the other",
    crossChannel.totalExposureUsd === 7000,
    `exposure $${crossChannel.totalExposureUsd} (4000 router + 3000 permit2 budget)`,
  );

  const unreadBudgetSum = await getApprovals(
    generated.address,
    [usdcAsset("10000")],
    MAINNET,
    {
      async multicall({ contracts }: { contracts: { address: string; args: readonly unknown[] }[] }) {
        return contracts.map((call) => {
          if (call.address.toLowerCase() === PERMIT2.toLowerCase()) {
            return String(call.args[2]).toLowerCase() === UNIVERSAL.toLowerCase()
              ? {
                  status: "success" as const,
                  result: [3_000_000_000n, future, 0] as const,
                }
              : { status: "success" as const, result: [0n, 0, 0] as const };
          }

          const spender = String(call.args[1]).toLowerCase();

          if (spender === PERMIT2.toLowerCase()) {
            return { status: "failure" as const, error: new Error("node hiccup") };
          }

          return {
            status: "success" as const,
            result: spender === ROUTER.toLowerCase() ? 4_000_000_000n : 0n,
          };
        });
      },
    } as unknown as Parameters<typeof getApprovals>[3],
  );

  check(
    "when the Permit2 budget cannot be read its permissions add to the direct ones, not replace them",
    unreadBudgetSum.totalExposureUsd === 7000,
    `exposure $${unreadBudgetSum.totalExposureUsd} (4000 direct + 3000 permit2 with unknown budget)`,
  );

  let directTruncationError: string | null = null;

  try {
    await getApprovals(
      generated.address,
      [usdcAsset("10000")],
      MAINNET,
      {
        async multicall({ contracts }: { contracts: { address: string }[] }) {
          const isPermit2 =
            contracts[0]?.address.toLowerCase() === PERMIT2.toLowerCase();

          return isPermit2
            ? contracts.map(() => ({
                status: "success" as const,
                result: [0n, 0, 0] as const,
              }))
            : contracts.slice(1).map(() => ({
                status: "success" as const,
                result: 0n,
              }));
        },
      } as unknown as Parameters<typeof getApprovals>[3],
    );
  } catch (error) {
    directTruncationError = error instanceof Error ? error.message : "unknown";
  }

  check(
    "a short answer on the direct half is caught too, not only on the Permit2 half",
    directTruncationError !== null &&
      directTruncationError.includes("fewer results"),
    directTruncationError ?? "no error",
  );

  let permit2TruncationError: string | null = null;

  try {
    await getApprovals(
      generated.address,
      [usdcAsset("10000")],
      MAINNET,
      {
        async multicall({ contracts }: { contracts: { address: string }[] }) {
          const isPermit2 =
            contracts[0]?.address.toLowerCase() === PERMIT2.toLowerCase();

          return isPermit2
            ? contracts.slice(1).map(() => ({
                status: "success" as const,
                result: [0n, 0, 0] as const,
              }))
            : contracts.map(() => ({
                status: "success" as const,
                result: 0n,
              }));
        },
      } as unknown as Parameters<typeof getApprovals>[3],
    );
  } catch (error) {
    permit2TruncationError = error instanceof Error ? error.message : "unknown";
  }

  check(
    "a short answer on the Permit2 half is caught too, not only on the direct half",
    permit2TruncationError !== null &&
      permit2TruncationError.includes("fewer results"),
    permit2TruncationError ?? "no error",
  );

  const heldButUnpriced = await getApprovals(
    generated.address,
    [usdcAsset("5000", null)],
    MAINNET,
    approvalsClient({
      token: usdc,
      direct: { [ROUTER.toLowerCase()]: 1_000_000_000n },
    }),
  );

  const emptyAndUnpriced = await getApprovals(
    generated.address,
    [usdcAsset("0", null)],
    MAINNET,
    approvalsClient({
      token: usdc,
      direct: { [ROUTER.toLowerCase()]: 1_000_000_000n },
    }),
  );

  check(
    "holding an unpriced token is scored higher than holding none of it",
    heldButUnpriced.approvals[0]?.risk === "medium" &&
      emptyAndUnpriced.approvals[0]?.risk === "low",
    `held: ${heldButUnpriced.approvals[0]?.risk}, empty: ${emptyAndUnpriced.approvals[0]?.risk}`,
  );

  check(
    "an unpriced approval on a wallet that holds the token is scored above one that does not",
    scoreApproval({
      unlimited: false,
      exposureUsd: null,
      spenderKnown: true,
      holdsTokens: true,
    }) === "medium" &&
      scoreApproval({
        unlimited: false,
        exposureUsd: null,
        spenderKnown: true,
        holdsTokens: false,
      }) === "low" &&
      scoreApproval({
        unlimited: true,
        exposureUsd: null,
        spenderKnown: true,
        holdsTokens: true,
      }) === "high",
    "unknown price is not silently treated as zero",
  );

  const unknownBudget = await getApprovals(
    generated.address,
    [usdcAsset("10000")],
    MAINNET,
    {
      async multicall({ contracts }: { contracts: { address: string; args: readonly unknown[] }[] }) {
        return contracts.map((call) => {
          if (call.address.toLowerCase() === PERMIT2.toLowerCase()) {
            const spender = String(call.args[2]).toLowerCase();

            return spender === UNIVERSAL.toLowerCase()
              ? {
                  status: "success" as const,
                  result: [9_000_000_000n, future, 0] as const,
                }
              : { status: "success" as const, result: [0n, 0, 0] as const };
          }

          if (String(call.args[1]).toLowerCase() === PERMIT2.toLowerCase()) {
            return { status: "failure" as const, error: new Error("node hiccup") };
          }

          return { status: "success" as const, result: 0n };
        });
      },
    } as unknown as Parameters<typeof getApprovals>[3],
  );

  check(
    "a Permit2 row whose budget could not be read is flagged as uncertain",
    unknownBudget.uncertainCount === 1 &&
      unknownBudget.approvals.every((row) => !row.exposureCertain),
    `uncertain rows: ${unknownBudget.uncertainCount}`,
  );

  check(
    "a budget probe that failed is counted as a read that did not happen",
    unknownBudget.unreadBudgetCount === 1 && twoSpenders.unreadBudgetCount === 0,
    `unread budgets: ${unknownBudget.unreadBudgetCount} on failure, ${twoSpenders.unreadBudgetCount} on success`,
  );

  const unreadPermit2 = await getApprovals(
    generated.address,
    [usdcAsset("10000")],
    MAINNET,
    {
      async multicall({
        contracts,
      }: {
        contracts: { address: string; args: readonly unknown[] }[];
      }) {
        return contracts.map((call) => {
          // The ERC-20 budget reads fine; every per-spender Permit2 lookup dies.
          if (call.address.toLowerCase() === PERMIT2.toLowerCase()) {
            return { status: "failure" as const, error: new Error("node down") };
          }

          return {
            status: "success" as const,
            result:
              String(call.args[1]).toLowerCase() === PERMIT2.toLowerCase()
                ? 500_000_000n
                : 0n,
          };
        });
      },
    } as unknown as Parameters<typeof getApprovals>[3],
  );

  check(
    "failed Permit2 lookups are counted, so a live budget with no readable spenders is not silence",
    unreadPermit2.unreadPermit2Count > 0 &&
      twoSpenders.unreadPermit2Count === 0,
    `unread lookups: ${unreadPermit2.unreadPermit2Count} on failure, ${twoSpenders.unreadPermit2Count} on success`,
  );

  const unpriced = await getApprovals(
    generated.address,
    [usdcAsset("10000", null)],
    MAINNET,
    approvalsClient({
      token: usdc,
      direct: { [ROUTER.toLowerCase()]: 2n ** 256n - 1n },
    }),
  );

  check(
    "an unlimited approval on a token with no price is not scored as harmless",
    unpriced.approvals[0]?.risk !== "low" &&
      unpriced.approvals[0]?.exposureCertain === false &&
      unpriced.totalExposureUsd === 0,
    `risk ${unpriced.approvals[0]?.risk}, certain ${unpriced.approvals[0]?.exposureCertain}`,
  );

  let truncatedError: string | null = null;

  try {
    await getApprovals(
      generated.address,
      [usdcAsset("10000")],
      MAINNET,
      {
        async multicall({ contracts }: { contracts: unknown[] }) {
          return contracts.slice(1).map(() => ({
            status: "success" as const,
            result: 0n,
          }));
        },
      } as unknown as Parameters<typeof getApprovals>[3],
    );
  } catch (error) {
    truncatedError = error instanceof Error ? error.message : "unknown";
  }

  check(
    "a short answer from the node fails loudly instead of reporting no risk",
    truncatedError !== null && truncatedError.includes("fewer results"),
    truncatedError ?? "no error",
  );

  const emptyWallet = await getApprovals(
    generated.address,
    [usdcAsset("0")],
    MAINNET,
    approvalsClient({
      token: usdc,
      direct: { [ROUTER.toLowerCase()]: 2n ** 256n - 1n },
    }),
  );

  check(
    "an unlimited approval on an empty balance is listed but risks nothing",
    emptyWallet.approvals.length === 1 &&
      emptyWallet.approvals[0].unlimited &&
      emptyWallet.totalExposureUsd === 0,
    `exposure $${emptyWallet.totalExposureUsd}, risk ${emptyWallet.approvals[0]?.risk}`,
  );

  check(
    "the spender count reports distinct contracts, not calls",
    twoSpenders.checkedSpenders ===
      new Set(
        [
          ...directSpenders.map((item) => item.address.toLowerCase()),
          ...permit2Spenders.map((item) => item.toLowerCase()),
        ],
      ).size,
    `${twoSpenders.checkedSpenders} distinct`,
  );

  const sixDecimals = normalizeTokenBalance("0x3b9aca00", 6);

  const missingDecimals = normalizeTokenBalance("0x1bc16d674ec80000", undefined);

  const garbageBalance = normalizeTokenBalance("0xzz", 18);

  const upperCaseHex = normalizeTokenBalance("0X3B9ACA00", 6);

  check(
    "a hex balance is never handed on as a number, in any case or without decimals",
    sixDecimals.balance === "1000" &&
      upperCaseHex.balance === "1000" &&
      Number(missingDecimals.balance) === 2 &&
      garbageBalance.balance === "0",
    `6dp: ${sixDecimals.balance}, 0X: ${upperCaseHex.balance}, unknown dp: ${missingDecimals.balance}`,
  );

  check(
    "a token whose decimals are unknown does not get an invented dollar value",
    missingDecimals.decimalsKnown === false && sixDecimals.decimalsKnown === true,
    `known: ${sixDecimals.decimalsKnown}, unknown: ${missingDecimals.decimalsKnown}`,
  );

  const vaultDeviceKey = webcrypto.getRandomValues(new Uint8Array(32));

  const vaultPinKey = webcrypto.getRandomValues(new Uint8Array(32));

  const vaultMaster = webcrypto.getRandomValues(new Uint8Array(32));

  const vaultWalletId = created.account.id;

  const slot = wrapMasterKey({
    masterKey: vaultMaster,
    deviceKey: vaultDeviceKey,
    pinKey: vaultPinKey,
    kekSalt: webcrypto.getRandomValues(new Uint8Array(16)),
    wrapNonce: webcrypto.getRandomValues(new Uint8Array(24)),
  });

  const sealed = sealWalletVault({
    mnemonic: generated.mnemonic,
    walletId: vaultWalletId,
    masterKey: vaultMaster,
    wrapNonce: webcrypto.getRandomValues(new Uint8Array(24)),
    nonce: webcrypto.getRandomValues(new Uint8Array(24)),
    dek: webcrypto.getRandomValues(new Uint8Array(32)),
  });

  check(
    "a sealed wallet opens with the master key and holds no readable phrase",
    openWalletVault({
      vault: sealed,
      walletId: vaultWalletId,
      masterKey: vaultMaster,
    }) === generated.mnemonic &&
      !JSON.stringify(sealed).includes(generated.mnemonic) &&
      /^[0-9a-f]+$/.test(sealed.ciphertext) &&
      !JSON.stringify(sealed).includes(" "),
    "round trip clean, envelope is opaque bytes",
  );

  check(
    "the master key itself is only reachable with the right PIN on the right device",
    (() => {
      const opened = unwrapMasterKey({
        slot,
        deviceKey: vaultDeviceKey,
        pinKey: vaultPinKey,
      });

      const wrongPin = (() => {
        try {
          unwrapMasterKey({
            slot,
            deviceKey: vaultDeviceKey,
            pinKey: webcrypto.getRandomValues(new Uint8Array(32)),
          });

          return false;
        } catch (error) {
          return error instanceof VaultKeyError;
        }
      })();

      const wrongDevice = (() => {
        try {
          unwrapMasterKey({
            slot,
            deviceKey: webcrypto.getRandomValues(new Uint8Array(32)),
            pinKey: vaultPinKey,
          });

          return false;
        } catch (error) {
          return error instanceof VaultKeyError;
        }
      })();

      return (
        bytesToHex(opened) === bytesToHex(vaultMaster) && wrongPin && wrongDevice
      );
    })(),
    "PIN factor and device factor are both required",
  );

  function refusesToOpen(label: string, open: () => string) {
    let failure: unknown = null;

    try {
      open();
    } catch (error) {
      failure = error;
    }

    check(
      label,
      failure instanceof VaultOpenError,
      failure instanceof Error ? failure.name : "opened anyway",
    );
  }

  refusesToOpen("another master key cannot open the sealed wallet", () =>
    openWalletVault({
      vault: sealed,
      walletId: vaultWalletId,
      masterKey: webcrypto.getRandomValues(new Uint8Array(32)),
    }),
  );

  refusesToOpen("a sealed wallet cannot be replayed under another wallet id", () =>
    openWalletVault({
      vault: sealed,
      walletId: "0x0000000000000000000000000000000000000001",
      masterKey: vaultMaster,
    }),
  );

  refusesToOpen("editing the ciphertext breaks the seal", () =>
    openWalletVault({
      vault: {
        ...sealed,
        ciphertext:
          (sealed.ciphertext[0] === "0" ? "1" : "0") +
          sealed.ciphertext.slice(1),
      },
      walletId: vaultWalletId,
      masterKey: vaultMaster,
    }),
  );

  refusesToOpen("swapping the nonce breaks the seal", () =>
    openWalletVault({
      vault: { ...sealed, nonce: bytesToHex(webcrypto.getRandomValues(new Uint8Array(24))) },
      walletId: vaultWalletId,
      masterKey: vaultMaster,
    }),
  );

  check(
    "a damaged envelope or key slot is refused by the parser, not half-read",
    parseWalletVault({ ...sealed, wrapped: 42 }) === null &&
      parseWalletVault({ ...sealed, nonce: "zz" }) === null &&
      parseWalletVault({ ...sealed, version: 1 }) === null &&
      parseWalletVault(sealed)?.version === 2 &&
      parseVaultKeySlot(JSON.stringify({ ...slot, kekSalt: "abc" })) === null &&
      parseVaultKeySlot(serializeVaultKeySlot(slot))?.version === 2,
    "malformed input never reaches the cipher",
  );

  const rotatedPinKey = webcrypto.getRandomValues(new Uint8Array(32));

  const rotated = wrapMasterKey({
    masterKey: vaultMaster,
    deviceKey: vaultDeviceKey,
    pinKey: rotatedPinKey,
    kekSalt: webcrypto.getRandomValues(new Uint8Array(16)),
    wrapNonce: webcrypto.getRandomValues(new Uint8Array(24)),
  });

  const oldPinRejected = (() => {
    try {
      unwrapMasterKey({
        slot: rotated,
        deviceKey: vaultDeviceKey,
        pinKey: vaultPinKey,
      });

      return false;
    } catch {
      return true;
    }
  })();

  check(
    "changing the PIN rewraps one key slot and leaves every wallet envelope untouched",
    openWalletVault({
      vault: sealed,
      walletId: vaultWalletId,
      masterKey: unwrapMasterKey({
        slot: rotated,
        deviceKey: vaultDeviceKey,
        pinKey: rotatedPinKey,
      }),
    }) === generated.mnemonic && oldPinRejected,
    "same envelope, new slot, old PIN refused",
  );

  const vaultBlobs = new Map<string, string>();

  const held = { masterKey: null as Uint8Array | null };

  const vaultStore: SecretStore = {
    async load(walletId) {
      const raw = vaultBlobs.get(walletId);

      if (!raw) {
        return null;
      }

      const parsed = parseWalletVault(JSON.parse(raw));

      if (!parsed) {
        return JSON.parse(raw) as WalletSecret;
      }

      if (!held.masterKey) {
        throw new Error("Enter your PIN to unlock this wallet");
      }

      return {
        version: 1 as const,
        mnemonic: openWalletVault({
          vault: parsed,
          walletId,
          masterKey: held.masterKey,
        }),
      };
    },

    async save(walletId, secret) {
      vaultBlobs.set(
        walletId,
        held.masterKey
          ? JSON.stringify(
              sealWalletVault({
                mnemonic: secret.mnemonic,
                walletId,
                masterKey: held.masterKey,
                wrapNonce: webcrypto.getRandomValues(new Uint8Array(24)),
                nonce: webcrypto.getRandomValues(new Uint8Array(24)),
                dek: webcrypto.getRandomValues(new Uint8Array(32)),
              }),
            )
          : JSON.stringify(secret),
      );
      return { durable: true };
    },

    async remove(walletId) {
      vaultBlobs.delete(walletId);
    },
  };

  const vaultEngine = createWalletEngine({
    storage: createMemoryStorage(),
    secrets: vaultStore,
    random: nodeRandom,
  });

  const prePin = await vaultEngine.prepare();

  const vaultedAccount = await vaultEngine.create(prePin.recoveryPhrase);

  check(
    "a wallet created before any PIN exists is stored in the clear",
    vaultBlobs.get(vaultedAccount.id)?.includes(prePin.recoveryPhrase) === true,
    "no PIN yet means no envelope",
  );

  held.masterKey = webcrypto.getRandomValues(new Uint8Array(32));

  const carriedOver = await vaultStore.load(vaultedAccount.id);

  await vaultStore.save(vaultedAccount.id, carriedOver!);

  check(
    "setting a PIN seals wallets that were already there and the phrase disappears",
    vaultBlobs.get(vaultedAccount.id)?.includes(prePin.recoveryPhrase) === false &&
      (await vaultStore.load(vaultedAccount.id))?.mnemonic ===
        prePin.recoveryPhrase,
    "sealed in place",
  );

  const heldKey = held.masterKey;

  held.masterKey = null;

  let lockedRead: unknown = null;

  try {
    await vaultStore.load(vaultedAccount.id);
  } catch (error) {
    lockedRead = error;
  }

  check(
    "a locked wallet refuses to hand over the phrase at all",
    lockedRead instanceof Error,
    lockedRead instanceof Error ? lockedRead.message : "handed it over",
  );

  held.masterKey = webcrypto.getRandomValues(new Uint8Array(32));

  let strangerRead: unknown = null;

  try {
    await vaultStore.load(vaultedAccount.id);
  } catch (error) {
    strangerRead = error;
  }

  check(
    "storage copied to a device with a different key does not give up the phrase",
    strangerRead instanceof VaultOpenError,
    strangerRead instanceof Error ? strangerRead.name : "opened anyway",
  );

  held.masterKey = heldKey;

  check(
    "the wallet still opens once the right key is back",
    (await vaultStore.load(vaultedAccount.id))?.mnemonic ===
      prePin.recoveryPhrase,
    "recovered",
  );

  function makeSlots(failAtWrite: number | null = null) {
    const values = new Map<string, string>();

    let writes = 0;

    const bump = () => {
      writes += 1;

      if (failAtWrite !== null && writes === failAtWrite) {
        throw new Error("device died mid-write");
      }
    };

    return {
      values,

      store: {
        async readSlot() {
          return values.get("slot") ?? null;
        },
        async writeSlot(value: string) {
          bump();
          values.set("slot", value);
        },
        async readPending() {
          return values.get("pending") ?? null;
        },
        async writePending(value: string) {
          bump();
          values.set("pending", value);
        },
        async removePending() {
          bump();
          values.delete("pending");
        },
      } satisfies SlotStore,
    };
  }

  const slotRandom = {
    async getBytes(length: number) {
      return webcrypto.getRandomValues(new Uint8Array(length));
    },
  };

  const deviceA = webcrypto.getRandomValues(new Uint8Array(32));

  const pinOld = webcrypto.getRandomValues(new Uint8Array(32));

  const pinNew = webcrypto.getRandomValues(new Uint8Array(32));

  const firstRun = makeSlots();

  const born = await openOrCreateVault({
    slots: firstRun.store,
    deviceKey: deviceA,
    pinKey: pinOld,
    random: slotRandom,
  });

  const reopened = await openOrCreateVault({
    slots: firstRun.store,
    deviceKey: deviceA,
    pinKey: pinOld,
    random: slotRandom,
  });

  check(
    "the master key is created once and comes back the same on every unlock",
    born.created &&
      !reopened.created &&
      bytesToHex(born.masterKey) === bytesToHex(reopened.masterKey),
    "stable across unlocks",
  );

  let wrongPinRejected = false;

  try {
    await openOrCreateVault({
      slots: firstRun.store,
      deviceKey: deviceA,
      pinKey: webcrypto.getRandomValues(new Uint8Array(32)),
      random: slotRandom,
    });
  } catch (error) {
    wrongPinRejected = error instanceof VaultKeyError;
  }

  check(
    "a wrong PIN never silently mints a second master key",
    wrongPinRejected && firstRun.values.size === 1,
    "refused without touching the slot",
  );

  const rotationBreakages: string[] = [];

  for (let failAt = 1; failAt <= 4; failAt++) {
    const run = makeSlots();

    const start = await openOrCreateVault({
      slots: run.store,
      deviceKey: deviceA,
      pinKey: pinOld,
      random: slotRandom,
    });

    try {
      await stageRotation({
        slots: run.store,
        deviceKey: deviceA,
        masterKey: start.masterKey,
        nextPinKey: pinNew,
        random: slotRandom,
      });
    } catch {
      void 0;
    }

    const openers: string[] = [];

    for (const [label, pinKey] of [
      ["old", pinOld],
      ["new", pinNew],
    ] as const) {
      try {
        const result = await openOrCreateVault({
          slots: run.store,
          deviceKey: deviceA,
          pinKey,
          random: slotRandom,
        });

        if (
          !result.created &&
          bytesToHex(result.masterKey) === bytesToHex(start.masterKey)
        ) {
          openers.push(label);
        }
      } catch {
        void 0;
      }
    }

    if (openers.length === 0) {
      rotationBreakages.push(`stage@${failAt}: nothing opens the vault`);
    }
  }

  check(
    "killing the app while a new PIN is being staged never strands the master key",
    rotationBreakages.length === 0,
    rotationBreakages[0] ?? "4 crash points swept",
  );

  const damaged = makeSlots();

  damaged.values.set("slot", "{not a slot");

  let damagedRejected: unknown = null;

  try {
    await openOrCreateVault({
      slots: damaged.store,
      deviceKey: deviceA,
      pinKey: pinOld,
      random: slotRandom,
    });
  } catch (error) {
    damagedRejected = error;
  }

  check(
    "a damaged key slot is reported, never quietly replaced with a fresh one",
    damagedRejected instanceof VaultKeyError &&
      damaged.values.get("slot") === "{not a slot",
    damagedRejected instanceof Error
      ? "refused and left untouched"
      : "minted a new key over it",
  );

  const orphaned = makeSlots();

  let orphanRejected: unknown = null;

  try {
    await openOrCreateVault({
      slots: orphaned.store,
      deviceKey: deviceA,
      pinKey: pinOld,
      random: slotRandom,
      sealedWalletsExist: true,
    });
  } catch (error) {
    orphanRejected = error;
  }

  check(
    "a missing key slot next to sealed wallets is an error, not a fresh start",
    orphanRejected instanceof VaultKeyError && orphaned.values.size === 0,
    orphanRejected instanceof Error
      ? "refused to mint a key that opens nothing"
      : "minted a useless key",
  );

  const promotion = makeSlots();

  const anchorKey = await openOrCreateVault({
    slots: promotion.store,
    deviceKey: deviceA,
    pinKey: pinOld,
    random: slotRandom,
  });

  await stageRotation({
    slots: promotion.store,
    deviceKey: deviceA,
    masterKey: anchorKey.masterKey,
    nextPinKey: pinNew,
    random: slotRandom,
  });

  const promoted = await openOrCreateVault({
    slots: promotion.store,
    deviceKey: deviceA,
    pinKey: pinNew,
    random: slotRandom,
  });

  const afterPromotion = await openOrCreateVault({
    slots: promotion.store,
    deviceKey: deviceA,
    pinKey: pinNew,
    random: slotRandom,
  });

  check(
    "the first unlock with the new PIN promotes it and the leftover is cleaned up",
    promoted.promoted &&
      !afterPromotion.promoted &&
      bytesToHex(afterPromotion.masterKey) ===
        bytesToHex(anchorKey.masterKey) &&
      !promotion.values.has("pending"),
    "promoted once, no leftovers",
  );

  const freezeStart = 1_700_000_000_000;

  const freeze = createFreeze(freezeStart);

  check(
    "a panic freeze blocks signing for its whole window and then lets go by itself",
    isFrozen(freeze, freezeStart + 1_000) &&
      isFrozen(freeze, freezeStart + FREEZE_DURATION_MS - 1) &&
      !isFrozen(freeze, freezeStart + FREEZE_DURATION_MS) &&
      !isFrozen(null, freezeStart),
    `${FREEZE_DURATION_MS / 3_600_000}h window, expires on its own`,
  );

  const walked = advanceFreeze(freeze, freezeStart + 2 * 60 * 60 * 1000);

  check(
    "winding the clock back does not shorten a freeze",
    isFrozen(walked, freezeStart - 10 * 24 * 60 * 60 * 1000) &&
      remainingFreezeMs(walked, freezeStart - 1_000_000) ===
        remainingFreezeMs(walked, freezeStart + 2 * 60 * 60 * 1000),
    "the highest clock ever seen is what counts",
  );

  const damagedFreezeRecords = [
    "{oops",
    JSON.stringify({ ...freeze, until: freeze.frozenAt - 1 }),
    JSON.stringify({ ...freeze, version: 2 }),
  ];

  const refusedDamaged = damagedFreezeRecords.filter((raw) => {
    try {
      parseFreeze(raw);

      return false;
    } catch (error) {
      return error instanceof FreezeStateUnreadableError;
    }
  });

  check(
    "a damaged lockdown record keeps signing blocked instead of quietly unlocking",
    refusedDamaged.length === damagedFreezeRecords.length &&
      parseFreeze(serializeFreeze(freeze))?.until === freeze.until &&
      parseFreeze(null) === null,
    "erasing the record is not a way out of a lockdown",
  );

  check(
    "the frozen error tells the user how long is left, in plain words",
    new WalletFrozenError(90 * 60 * 1000).message.includes("2 hours") &&
      new WalletFrozenError(30 * 1000).message.includes("1 minute"),
    new WalletFrozenError(90 * 60 * 1000).message.slice(0, 60),
  );

  unlockSession();

  const frozenSigner = createLocalMnemonicSigner({
    engine,
    secrets,
    assertNotFrozen: async () => {
      throw new WalletFrozenError(3 * 60 * 60 * 1000);
    },
  });

  const frozenAttempts: string[] = [];

  for (const [label, attempt] of [
    ["address", () => frozenSigner.getAddress()],
    ["message", () => frozenSigner.signMessage("anything")],
    [
      "transaction",
      () =>
        frozenSigner.signTransaction({
          type: "eip1559",
          chainId: 1,
          from: generated.address,
          to: "0x000000000000000000000000000000000000dEaD",
          value: 1n,
          nonce: 0,
          gas: 21000n,
          maxFeePerGas: 1n,
          maxPriorityFeePerGas: 1n,
          data: "0x",
        }),
    ],
  ] as const) {
    try {
      await attempt();

      frozenAttempts.push(`${label} went through`);
    } catch (error) {
      if (!(error instanceof WalletFrozenError)) {
        frozenAttempts.push(`${label} failed for the wrong reason`);
      }
    }
  }

  check(
    "a frozen wallet refuses every signature, not just transfers",
    frozenAttempts.length === 0,
    frozenAttempts[0] ?? "address, message and transaction all refused",
  );

  check(
    "the approval exposure formula is one formula, shared by the scan and the firewall",
    approvalExposureUsd({
      allowanceTokens: 5000,
      balanceTokens: 1000,
      priceUsd: 1,
      unlimited: false,
    }) === 1000 &&
      approvalExposureUsd({
        allowanceTokens: 100,
        balanceTokens: 1000,
        priceUsd: 1,
        unlimited: false,
      }) === 100 &&
      approvalExposureUsd({
        allowanceTokens: 0,
        balanceTokens: 1000,
        priceUsd: 2,
        unlimited: true,
      }) === 2000 &&
      approvalExposureUsd({
        allowanceTokens: 100,
        balanceTokens: 1000,
        priceUsd: null,
        unlimited: false,
      }) === null,
    "capped by balance, unlimited reaches the balance, no price means unknown",
  );

  const onTestnet = (intent: PolicyIntent) =>
    decidePolicy({
      intent,
      policy: guardedPolicy,
      context,
      networkKind: "testnet",
      priceAvailability: "unavailable",
    });

  check(
    "dollar rules step aside on a network without prices, for approvals and swaps too",
    onTestnet({
      kind: "approval",
      spender: stranger,
      spenderKnown: true,
      unlimited: false,
      revoking: false,
      exposureUsd: null,
    }).decision === "uncovered" &&
      onTestnet({ kind: "swap", lossUsd: null }).decision === "uncovered",
    "no price on a testnet no longer blocks every approval and swap",
  );

  check(
    "the rules that need no price still apply on a testnet",
    onTestnet({
      kind: "approval",
      spender: stranger,
      spenderKnown: true,
      unlimited: true,
      revoking: false,
      exposureUsd: null,
    }).decision === "block" &&
      onTestnet({
        kind: "approval",
        spender: stranger,
        spenderKnown: false,
        unlimited: false,
        revoking: false,
        exposureUsd: null,
      }).decision === "block",
    "unlimited and unknown spender are refused everywhere",
  );

  check(
    "amounts are added exactly, never through floating point",
    addDecimalAmounts(["0.1", "0.2"]) === "0.3" &&
      addDecimalAmounts(["0.318700000000000123"]) ===
        "0.318700000000000123" &&
      addDecimalAmounts(["0.0000005"]) === "0.0000005" &&
      addDecimalAmounts(["5000000000000000000000"]) ===
        "5000000000000000000000" &&
      addDecimalAmounts(["0.2", "0.1187"]) === "0.3187" &&
      addDecimalAmounts(["1", "2.5"]) === "3.5",
    "no rounding, no exponent notation, no invented digits",
  );

  check(
    "junk amounts are refused instead of silently becoming zero",
    addDecimalAmounts(["abc"]) === null &&
      addDecimalAmounts(["1e-19"]) === null &&
      addDecimalAmounts([]) === null &&
      isPositiveAmount("0") === false &&
      isPositiveAmount("0.000") === false &&
      isPositiveAmount("-1") === false &&
      isPositiveAmount("0.0000000001") === true,
    "unparsable input never turns into a number on screen",
  );

  const swapHash = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

  const trackedSwap = {
    version: 1 as const,
    hash: swapHash as `0x${string}`,
    chainId: 1,
    walletId: created.account.id,
    from: generated.address,
    to: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45" as const,
    assetType: "swap" as const,
    symbol: "USDC",
    valueWei: "1000000",
    tokenDecimals: 6,
    symbolOut: "ETH",
    valueOutWei: "320000000000000000",
    tokenOutDecimals: 18,
    createdAt: Date.now(),
    status: "confirmed" as const,
    blockNumber: null,
    gasUsed: null,
    gasLimit: "200000",
    route: "Uniswap V3, direct pool",
    effectiveGasPriceWei: null,
    confirmedAt: null,
  };

  const chainCredit = {
    id: "chain:1",
    hash: swapHash as `0x${string}`,
    status: "confirmed" as const,
    direction: "received" as const,
    origin: "native-transfer" as const,
    assetType: "native" as const,
    symbol: "ETH",
    amount: "0.3187",
    from: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45" as const,
    to: generated.address,
    contractAddress: null,
    blockNumber: null,
    timestamp: Date.now(),
  };

  const enriched = mergeActivity([chainCredit], [trackedSwap], generated.address);

  const withoutChain = mergeActivity([], [trackedSwap], generated.address);

  check(
    "a finished swap shows what actually arrived, not what was quoted",
    enriched.length === 1 &&
      enriched[0].amountOut === "0.3187" &&
      enriched[0].amountOutIsQuote === false,
    `shown: ${enriched[0]?.amountOut} (quote was 0.32)`,
  );

  check(
    "until the chain confirms the amount, the quote is marked as a quote",
    withoutChain[0].amountOut === "0.32" &&
      withoutChain[0].amountOutIsQuote === true,
    "quoted output is never presented as received",
  );

  const splitCredits = mergeActivity(
    [
      { ...chainCredit, id: "chain:a", amount: "0.2" },
      { ...chainCredit, id: "chain:b", amount: "0.1187" },
      {
        ...chainCredit,
        id: "chain:c",
        amount: "5",
        to: "0x0000000000000000000000000000000000000001" as const,
      },
    ],
    [trackedSwap],
    generated.address,
  );

  check(
    "a swap paid out in several transfers is added up, and other people's credits are not",
    splitCredits[0].amountOut === "0.3187" &&
      splitCredits[0].amountOutIsQuote === false,
    `summed: ${splitCredits[0]?.amountOut}`,
  );

  const realUsdc = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const;

  const fakeUsdc = "0x00000000000000000000000000000000deadbeef" as const;

  const tokenSwap = {
    ...trackedSwap,
    symbolOut: "USDC",
    contractAddressOut: realUsdc,
    tokenOutDecimals: 6,
    valueOutWei: "1000000",
  };

  const impostor = mergeActivity(
    [
      {
        ...chainCredit,
        id: "chain:real",
        assetType: "erc20" as const,
        symbol: "USDC",
        contractAddress: realUsdc,
        amount: "0.5",
      },
      {
        ...chainCredit,
        id: "chain:fake",
        assetType: "erc20" as const,
        symbol: "USDC",
        contractAddress: fakeUsdc,
        amount: "999",
      },
    ],
    [tokenSwap],
    generated.address,
  );

  check(
    "a token that merely shares a ticker cannot inflate what the swap paid out",
    impostor[0].amountOut === "0.5",
    `credited: ${impostor[0]?.amountOut} (impostor offered 999)`,
  );

  const incoming = resolveDetailsAsset({
    tracked: null,
    hint: { symbol: "USDC", amount: "500", assetType: "erc20" },
    chainValueWei: 0n,
    nativeSymbol: "ETH",
  });

  check(
    "an incoming token transfer is not shown as zero ether",
    incoming.symbol === "USDC" &&
      incoming.displayAmount === "500" &&
      incoming.kind === "transfer",
    `${incoming.displayAmount} ${incoming.symbol}`,
  );

  const bare = resolveDetailsAsset({
    tracked: null,
    hint: null,
    chainValueWei: 10n ** 18n,
    nativeSymbol: "ETH",
  });

  check(
    "with nothing known, the chain value is shown in the native asset",
    bare.symbol === "ETH" && bare.displayAmount === "1",
    `${bare.displayAmount} ${bare.symbol}`,
  );

  const junkHint = resolveDetailsAsset({
    tracked: null,
    hint: { symbol: "USDC", amount: "5e-7", assetType: "erc20" },
    chainValueWei: 0n,
    nativeSymbol: "ETH",
  });

  check(
    "an unparsable amount falls back to the chain instead of inventing one",
    junkHint.displayAmount === "0" && junkHint.symbol === "ETH",
    "junk hint is refused, not displayed",
  );

  const approval = resolveDetailsAsset({
    tracked: {
      assetType: "approve",
      symbol: "USDC",
      valueWei: "1000000",
      tokenDecimals: 6,
    },
    hint: null,
    chainValueWei: 0n,
    nativeSymbol: "ETH",
  });

  check(
    "an approval is marked as an allowance, not as money that moved",
    approval.kind === "approve" && approval.displayAmount === "1",
    `kind=${approval.kind}`,
  );

  const swapDetails = resolveDetailsAsset({
    tracked: {
      assetType: "swap",
      symbol: "USDC",
      valueWei: "1000000",
      tokenDecimals: 6,
      symbolOut: "ETH",
    },
    hint: { amountOut: "0.3187" },
    chainValueWei: 0n,
    nativeSymbol: "ETH",
  });

  check(
    "a swap detail carries both sides, not just what was paid in",
    swapDetails.kind === "swap" &&
      swapDetails.symbolOut === "ETH" &&
      swapDetails.amountOut === "0.3187" &&
      swapDetails.amountOutIsQuote === false &&
      swapDetails.displayAmount === "1",
    `${swapDetails.displayAmount} ${swapDetails.symbol} → ${swapDetails.amountOut} ${swapDetails.symbolOut}`,
  );

  const quotedDetails = resolveDetailsAsset({
    tracked: {
      assetType: "swap",
      symbol: "USDC",
      valueWei: "1000000",
      tokenDecimals: 6,
      symbolOut: "ETH",
    },
    hint: { amountOut: "0.32", amountOutIsQuote: true },
    chainValueWei: 0n,
    nativeSymbol: "ETH",
  });

  check(
    "the details screen learns that an unconfirmed output is only a quote",
    quotedDetails.amountOut === "0.32" &&
      quotedDetails.amountOutIsQuote === true,
    "the quote flag survives the trip from the list to the details",
  );

  check(
    "the shown amount never depends on guessing decimals from the raw value",
    resolveDetailsAsset({
      tracked: null,
      hint: { symbol: "USDC", amount: "500", assetType: "erc20" },
      chainValueWei: 0n,
      nativeSymbol: "ETH",
    }).displayAmount === "500" &&
      resolveDetailsAsset({
        tracked: null,
        hint: null,
        chainValueWei: 10n ** 18n,
        nativeSymbol: "ETH",
      }).displayAmount === "1",
    "display amount is carried, not recomputed from a rescaled field",
  );

  const revealed = revealSecret(generated.mnemonic, generated.address);

  check(
    "the wallet can show its own phrase and a private key that matches its address",
    revealed.recoveryPhrase === generated.mnemonic &&
      /^0x[0-9a-f]{64}$/.test(revealed.privateKey) &&
      privateKeyToAccount(revealed.privateKey).address === generated.address,
    `${revealed.privateKey.slice(0, 10)}… controls ${generated.address}`,
  );

  let mismatched: unknown = null;

  try {
    revealSecret(
      generated.mnemonic,
      "0x0000000000000000000000000000000000000001",
    );
  } catch (error) {
    mismatched = error;
  }

  check(
    "a phrase that belongs to another wallet is never shown",
    mismatched instanceof Error,
    mismatched instanceof Error ? mismatched.message.slice(0, 48) : "shown",
  );

  const swapDeployment = getUniswapDeployment("eth-mainnet")!;

  const swapNow = 1_700_000_000_000;

  const swapNowSeconds = BigInt(Math.floor(swapNow / 1000));

  function swapWithDeadline(deadline: bigint) {
    return {
      kind: "swap" as const,
      chainId: 1,
      from: generated.address,
      assetIn: { address: usdc, symbol: "USDC", decimals: 6 },
      assetOut: { address: null, symbol: "ETH", decimals: 18 },
      amountIn: 1_000_000n,
      quotedAmountOut: 1_000_000_000_000_000n,
      minAmountOut: (1_000_000_000_000_000n * 9950n) / 10_000n,
      slippageBps: 50,
      route: { kind: "single" as const, fee: 500 as const },
      deadline,
    };
  }

  function deadlineVerdict(deadline: bigint) {
    try {
      validateSwapIntent(swapWithDeadline(deadline), {
        now: swapNow,
        expectedChainId: 1,
        expectedFrom: generated.address,
        deployment: swapDeployment,
      });

      return "accepted";
    } catch (error) {
      return error instanceof TransactionValidationError
        ? error.message
        : "wrong error";
    }
  }

  check(
    "a swap that already expired is refused instead of being signed",
    deadlineVerdict(swapNowSeconds - 1n).includes("already expired"),
    deadlineVerdict(swapNowSeconds - 1n),
  );

  check(
    "a swap that would stay valid for days is refused",
    deadlineVerdict(swapNowSeconds + 86_400n).includes("far too long"),
    deadlineVerdict(swapNowSeconds + 86_400n),
  );

  check(
    "a swap with a sane deadline still goes through",
    deadlineVerdict(swapNowSeconds + 900n) === "accepted",
    deadlineVerdict(swapNowSeconds + 900n),
  );

  const swapContext = buildPolicyContext({
    owner: generated.address,
    activity: [],
    tracked: [
      {
        version: 1,
        hash: "0x02",
        chainId: 1,
        walletId: created.account.id,
        from: generated.address,
        to: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
        assetType: "swap",
        symbol: "ETH",
        valueWei: (10n ** 19n).toString(),
        valueUsd: 30000,
        createdAt: Date.now() - 60_000,
        status: "confirmed",
        blockNumber: null,
        gasUsed: null,
        gasLimit: "200000",
        route: "Uniswap V3, direct pool",
        effectiveGasPriceWei: null,
        confirmedAt: null,
      },
      {
        version: 1,
        hash: "0x03",
        chainId: 1,
        walletId: created.account.id,
        from: generated.address,
        to: "0x000000000000000000000000000000000000dEaD",
        assetType: "erc20",
        symbol: "GONE",
        valueWei: (4000n * 10n ** 6n).toString(),
        tokenDecimals: 6,
        valueUsd: 4000,
        createdAt: Date.now() - 60_000,
        status: "confirmed",
        blockNumber: null,
        gasUsed: null,
        gasLimit: "200000",
        route: "Uniswap V3, direct pool",
        effectiveGasPriceWei: null,
        confirmedAt: null,
      },
    ] as never,
    priceOf: () => null,
  });

  check(
    "a swap is not counted as outflow, but the spent token counts at its stored price",
    swapContext.spentTodayUsd === 4000,
    `outflow $${swapContext.spentTodayUsd}`,
  );

  const dustContext = buildPolicyContext({
    owner: generated.address,
    activity: [],
    tracked: [
      {
        version: 1,
        hash: "0x04",
        chainId: 1,
        walletId: created.account.id,
        from: generated.address,
        to: "0x00000000000000000000000000000000000000Ff",
        assetType: "native",
        symbol: "ETH",
        valueWei: "1",
        createdAt: Date.now(),
        status: "pending",
        blockNumber: null,
        gasUsed: null,
        gasLimit: "200000",
        route: "Uniswap V3, direct pool",
        effectiveGasPriceWei: null,
        confirmedAt: null,
      },
    ] as never,
    priceOf: () => 2000,
  });

  check(
    "unconfirmed dust does not make an address known",
    dustContext.knownRecipients.length === 0,
  );

  const selfHash =
    "0xc5ffd73b8a7a41fdc2180901afcaaf038defa7757aadb36f052a2bdb57abe002" as const;

  const selfTransfer = {
    id: "chain:self",
    hash: selfHash,
    status: "confirmed" as const,
    direction: resolveDirection(
      generated.address,
      generated.address,
      generated.address,
    ),
    origin: "native-transfer" as const,
    assetType: "native" as const,
    symbol: "ETH",
    amount: "0.01",
    from: generated.address,
    to: generated.address,
    contractAddress: null,
    blockNumber: null,
    timestamp: Date.now(),
  };

  check(
    "a transfer to your own address is not counted as money leaving",
    selfTransfer.direction === "self" && isOutflow(selfTransfer.direction) === false,
    `direction: ${selfTransfer.direction}`,
  );

  const selfPresentation = presentActivity(selfTransfer);

  check(
    "a self transfer is never shown with a minus in front of it",
    selfPresentation.amountSign === "" &&
      selfPresentation.title === "Moved ETH to yourself" &&
      selfPresentation.note !== null,
    `"${selfPresentation.title}", sign "${selfPresentation.amountSign}"`,
  );

  const outgoing = presentActivity({ ...selfTransfer, direction: "sent", to: stranger });

  check(
    "a real outgoing transfer still shows the minus and the recipient",
    outgoing.amountSign === "-" &&
      outgoing.counterparty === stranger &&
      outgoing.counterpartyLabel === "To",
    `sign "${outgoing.amountSign}" to ${outgoing.counterparty?.slice(0, 8)}…`,
  );

  const selfContext = buildPolicyContext({
    owner: generated.address,
    activity: [selfTransfer],
    tracked: [
      {
        version: 1,
        hash: selfHash,
        chainId: 1,
        walletId: created.account.id,
        from: generated.address,
        to: generated.address,
        assetType: "native",
        symbol: "ETH",
        valueWei: "10000000000000000",
        createdAt: Date.now(),
        status: "confirmed",
        blockNumber: null,
        gasUsed: null,
        gasLimit: "200000",
        route: "Uniswap V3, direct pool",
        effectiveGasPriceWei: null,
        confirmedAt: null,
      },
    ] as never,
    priceOf: () => 2000,
  });

  check(
    "moving coins to yourself does not eat into the daily outflow limit",
    selfContext.spentTodayUsd === 0,
    `counted $${selfContext.spentTodayUsd}`,
  );

  check(
    "your own address never becomes a known recipient",
    selfContext.knownRecipients.length === 0,
    `known: ${selfContext.knownRecipients.length}`,
  );

  const pricedAsset = {
    type: "native" as const,
    symbol: "ETH",
    name: "Ethereum",
    balance: "2",
    decimals: 18,
    decimalsKnown: true,
    priceUsd: 2000,
    valueUsd: 4000,
    logo: null,
  };

  const unpricedAsset = {
    type: "erc20" as const,
    symbol: "USDC",
    name: "USDC",
    balance: "17",
    decimals: 6,
    decimalsKnown: true,
    priceUsd: null,
    valueUsd: null,
    logo: null,
  };

  const nothingHeld = { ...unpricedAsset, symbol: "DUST", balance: "0" };

  const noPrices = valuePortfolio([
    { ...pricedAsset, priceUsd: null, valueUsd: null },
    unpricedAsset,
  ]);

  check(
    "a wallet whose assets have no price is not worth zero dollars",
    noPrices.coverage === "unavailable" && noPrices.totalUsd === null,
    `total: ${String(noPrices.totalUsd)}`,
  );

  const partial = valuePortfolio([pricedAsset, unpricedAsset]);

  check(
    "a total that silently drops an asset without a price is marked as partial",
    partial.coverage === "partial" &&
      partial.totalUsd === 4000 &&
      partial.unvaluedSymbols.join(",") === "USDC" &&
      describeValuation(partial) !== null,
    describeValuation(partial) ?? "no note",
  );

  const complete = valuePortfolio([pricedAsset, nothingHeld]);

  check(
    "an empty balance does not make an otherwise complete total look partial",
    complete.coverage === "complete" &&
      complete.totalUsd === 4000 &&
      describeValuation(complete) === null,
    `coverage: ${complete.coverage}`,
  );

  const briefingPolicy = {
    ...DEFAULT_SECURITY_POLICY,
    maxSingleTransferUsd: 5000,
    newRecipientMaxUsd: 500,
    dailyOutflowLimitUsd: 10000,
  };

  const knownRecipientReview = reviewTransfer({
    recipient: stranger,
    symbol: "ETH",
    amount: "1",
    amountUsd: 2000,
    recipientIsContract: false,
    policy: briefingPolicy,
    context: { knownRecipients: [stranger.toLowerCase()], spentTodayUsd: 100 },
    networkKind: "mainnet",
    priceAvailability: "available",
  });

  check(
    "an allowed transfer says out loud what was checked",
    knownRecipientReview.decision.decision === "allow" &&
      knownRecipientReview.checks.length >= 3 &&
      knownRecipientReview.checks.every((item) => item.status !== "blocked") &&
      knownRecipientReview.checks.some(
        (item) =>
          item.id === "recipient-history" &&
          item.status === "pass" &&
          item.title === "You have sent to this address before",
      ) &&
      knownRecipientReview.checks.some(
        (item) =>
          item.id === "single-transfer-limit" &&
          item.title === "Within your $5,000 limit",
      ),
    knownRecipientReview.checks.map((item) => item.title).join(" / "),
  );

  const firstTimeReview = reviewTransfer({
    recipient: stranger,
    symbol: "ETH",
    amount: "0.1",
    amountUsd: 200,
    recipientIsContract: false,
    policy: briefingPolicy,
    context: { knownRecipients: [], spentTodayUsd: 0 },
    networkKind: "mainnet",
    priceAvailability: "available",
  });

  check(
    "a first transfer to an unknown address is flagged without blocking it",
    firstTimeReview.decision.decision === "allow" &&
      firstTimeReview.checks.some(
        (item) =>
          item.id === "recipient-history" && item.status === "attention",
      ),
    firstTimeReview.checks.find((item) => item.id === "recipient-history")
      ?.title ?? "missing",
  );

  const blockedReview = reviewTransfer({
    recipient: stranger,
    symbol: "ETH",
    amount: "10",
    amountUsd: 20000,
    recipientIsContract: false,
    policy: briefingPolicy,
    context: { knownRecipients: [], spentTodayUsd: 0 },
    networkKind: "mainnet",
    priceAvailability: "available",
  });

  const blockedChecks = blockedReview.checks.filter(
    (item) => item.status === "blocked",
  );

  check(
    "a blocked transfer can never show an all-clear briefing",
    blockedReview.decision.decision === "block" &&
      blockedChecks.length > 0 &&
      blockedChecks.some(
        (item) =>
          item.detail ===
          (blockedReview.decision.decision === "block"
            ? blockedReview.decision.message
            : null),
      ),
    blockedChecks.map((item) => item.title).join(" / "),
  );

  const testnetReview = reviewTransfer({
    recipient: stranger,
    symbol: "ETH",
    amount: "10",
    amountUsd: null,
    recipientIsContract: false,
    policy: briefingPolicy,
    context: { knownRecipients: [], spentTodayUsd: 0 },
    networkKind: "testnet",
    priceAvailability: "unavailable",
  });

  check(
    "on a test network the briefing admits the limits are not being applied",
    testnetReview.decision.decision === "uncovered" &&
      testnetReview.checks.some(
        (item) =>
          item.id === "single-transfer-limit" && item.status === "unchecked",
      ) &&
      testnetReview.checks.every((item) => item.status !== "blocked"),
    testnetReview.checks.map((item) => `${item.status}`).join(","),
  );

  const unlimitedApproval = reviewApproval({
    spender: stranger,
    spenderName: null,
    spenderKnown: false,
    token: "USDC",
    allowanceLabel: "no limit",
    unlimited: true,
    revoking: false,
    exposureUsd: null,
    policy: DEFAULT_SECURITY_POLICY,
    networkKind: "mainnet",
  });

  check(
    "an unlimited approval is refused and the briefing says so",
    unlimitedApproval.decision.decision === "block" &&
      unlimitedApproval.checks.some(
        (item) => item.id === "approval-bounded" && item.status === "blocked",
      ),
    unlimitedApproval.checks.map((item) => item.title).join(" / "),
  );

  const boundedApproval = reviewApproval({
    spender: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
    spenderName: "Permit2",
    spenderKnown: true,
    token: "USDC",
    allowanceLabel: "1000 USDC",
    unlimited: false,
    revoking: false,
    exposureUsd: 1000,
    policy: { ...DEFAULT_SECURITY_POLICY, maxApprovalExposureUsd: 5000 },
    networkKind: "mainnet",
  });

  check(
    "a bounded approval to a known contract states the cap and the exposure",
    boundedApproval.decision.decision === "allow" &&
      boundedApproval.checks.some(
        (item) => item.id === "approval-bounded" && item.status === "pass",
      ) &&
      boundedApproval.checks.some(
        (item) =>
          item.id === "approval-exposure" &&
          item.title === "At most $1,000 is exposed",
      ),
    boundedApproval.checks.map((item) => item.title).join(" / "),
  );

  const swapReview = reviewSwap({
    symbolIn: "USDC",
    symbolOut: "ETH",
    amountIn: "1000",
    minAmountOut: "0.31",
    slippagePercent: "0.50%",
    deadlineMinutes: 15,
    routerKnown: true,
    routeLabel: "Uniswap V3, direct pool",
    lossUsd: 40,
    policy: { ...DEFAULT_SECURITY_POLICY, maxSwapLossUsd: 100 },
    networkKind: "mainnet",
  });

  check(
    "a swap briefing names the floor, the expiry and the worst case",
    swapReview.decision.decision === "allow" &&
      swapReview.checks.some(
        (item) =>
          item.id === "swap-minimum" &&
          item.title === "You receive at least 0.31 ETH",
      ) &&
      swapReview.checks.some(
        (item) => item.id === "swap-deadline" && item.status === "pass",
      ) &&
      swapReview.checks.some(
        (item) =>
          item.id === "swap-worst-case" &&
          item.title === "Worst case costs you $40",
      ),
    swapReview.checks.map((item) => item.title).join(" / "),
  );

  const lossySwap = reviewSwap({
    symbolIn: "USDC",
    symbolOut: "ETH",
    amountIn: "1000",
    minAmountOut: "0.2",
    slippagePercent: "0.50%",
    deadlineMinutes: 15,
    routerKnown: true,
    routeLabel: "Uniswap V3, direct pool",
    lossUsd: 400,
    policy: { ...DEFAULT_SECURITY_POLICY, maxSwapLossUsd: 100 },
    networkKind: "mainnet",
  });

  check(
    "a swap over the loss limit is blocked and the briefing shows it",
    lossySwap.decision.decision === "block" &&
      lossySwap.checks.some(
        (item) => item.id === "swap-worst-case" && item.status === "blocked",
      ),
    lossySwap.checks.find((item) => item.status === "blocked")?.title ??
      "missing",
  );

  const poisonedAddress = "0x000000000000000000000000000000000000BAad" as const;

  const poisonContext = buildPolicyContext({
    owner: generated.address,
    activity: [
      {
        id: "chain:poison",
        hash: "0xdead000000000000000000000000000000000000000000000000000000000001",
        status: "confirmed",
        direction: "sent",
        origin: "token-log",
        assetType: "erc20",
        symbol: "USDC",
        amount: "1",
        from: generated.address,
        to: poisonedAddress,
        contractAddress: "0x00000000000000000000000000000000deadbeef",
        blockNumber: null,
        timestamp: Date.now(),
      },
      {
        id: "chain:real",
        hash: "0xdead000000000000000000000000000000000000000000000000000000000002",
        status: "confirmed",
        direction: "sent",
        origin: "native-transfer",
        assetType: "native",
        symbol: "ETH",
        amount: "1",
        from: generated.address,
        to: stranger,
        contractAddress: null,
        blockNumber: null,
        timestamp: Date.now(),
      },
    ],
    tracked: [],
    priceOf: () => 2000,
  });

  check(
    "a token transfer log nobody signed cannot make an address look familiar",
    poisonContext.knownRecipients.includes(poisonedAddress.toLowerCase()) ===
      false && poisonContext.knownRecipients.includes(stranger.toLowerCase()),
    `known: ${poisonContext.knownRecipients.join(", ")}`,
  );

  const poisonedReview = reviewTransfer({
    recipient: poisonedAddress,
    symbol: "ETH",
    amount: "1",
    amountUsd: 2000,
    recipientIsContract: false,
    policy: briefingPolicy,
    context: poisonContext,
    networkKind: "mainnet",
    priceAvailability: "available",
  });

  check(
    "an address planted by a fake transfer is still shown as a first-time recipient",
    poisonedReview.checks.some(
      (item) => item.id === "recipient-history" && item.status === "attention",
    ),
    poisonedReview.checks.find((item) => item.id === "recipient-history")
      ?.title ?? "missing",
  );

  const contradictionReview = reviewTransfer({
    recipient: stranger,
    symbol: "ETH",
    amount: "10",
    amountUsd: 20000,
    recipientIsContract: false,
    policy: briefingPolicy,
    context: { knownRecipients: [], spentTodayUsd: 0 },
    networkKind: "mainnet",
    priceAvailability: "available",
  });

  check(
    "a blocked briefing never puts a tick next to a limit the amount actually breaks",
    contradictionReview.checks.every(
      (item) => item.status !== "pass" || !item.title.startsWith("Within"),
    ) &&
      contradictionReview.checks.some(
        (item) =>
          item.id === "daily-outflow" &&
          item.status === "attention" &&
          item.title.startsWith("Over"),
      ),
    contradictionReview.checks
      .map((item) => `${item.status}:${item.title}`)
      .join(" / "),
  );

  const contractReview = reviewTransfer({
    recipient: stranger,
    symbol: "USDC",
    amount: "100",
    amountUsd: 100,
    recipientIsContract: true,
    policy: briefingPolicy,
    context: { knownRecipients: [], spentTodayUsd: 0 },
    networkKind: "mainnet",
    priceAvailability: "available",
  });

  check(
    "sending to a contract is called out instead of a blanket all-clear",
    contractReview.checks.some(
      (item) =>
        item.id === "recipient-is-contract" && item.status === "attention",
    ) &&
      contractReview.checks.every(
        (item) => item.title !== "No contract gains access to your tokens",
      ),
    contractReview.checks.find((item) => item.id === "recipient-is-contract")
      ?.title ?? "missing",
  );

  const reportOwner = generated.address;

  const usdcToken = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const;

  const paddedOwner = `0x${"0".repeat(24)}${reportOwner.slice(2).toLowerCase()}`;

  const credited = creditedFromLogs({
    logs: [
      {
        address: usdcToken,
        topics: [
          ERC20_TRANSFER_TOPIC,
          `0x${"0".repeat(24)}68b3465833fb72a70ecdf485e0e4c7bd8665fc45`,
          paddedOwner,
        ],
        data: "0x0000000000000000000000000000000000000000000000000000000012a05f20",
      },
      {
        address: "0x00000000000000000000000000000000deadbeef",
        topics: [
          ERC20_TRANSFER_TOPIC,
          `0x${"0".repeat(24)}68b3465833fb72a70ecdf485e0e4c7bd8665fc45`,
          paddedOwner,
        ],
        data: "0x00000000000000000000000000000000000000000000003635c9adc5dea00000",
      },
    ],
    owner: reportOwner,
    token: usdcToken,
  });

  check(
    "what arrived is read from the receipt, and only from the right token",
    credited === 312500000n,
    `credited ${String(credited)} (an impostor token log was in the same receipt)`,
  );

  const notCredited = creditedFromLogs({
    logs: [
      {
        address: usdcToken,
        topics: [
          ERC20_TRANSFER_TOPIC,
          paddedOwner,
          `0x${"0".repeat(24)}68b3465833fb72a70ecdf485e0e4c7bd8665fc45`,
        ],
        data: "0x0000000000000000000000000000000000000000000000000000000012a05f20",
      },
    ],
    owner: reportOwner,
    token: usdcToken,
  });

  check(
    "a token leaving the wallet is never counted as what it received",
    notCredited === null,
    `credited ${String(notCredited)}`,
  );

  const executed = analyzeExecution({
    amountIn: "1000",
    symbolIn: "USDC",
    symbolOut: "ETH",
    quotedAmountOut: "0.31582",
    minAmountOut: "0.31424",
    actualAmountOut: "0.31491",
    gasUsed: "150000",
    gasLimit: "200000",
    route: "Uniswap V3, direct pool",
    effectiveGasPriceWei: "20000000000",
    nativeSymbol: "ETH",
    quotedAt: 1_000_000,
    confirmedAt: 1_012_000,
  });

  check(
    "an execution report states the gap between quote and reality exactly",
    executed.deviation?.amount === "-0.00091" &&
      executed.deviation.worseThanQuote === true &&
      executed.gasNative === "0.003" &&
      executed.secondsToConfirm === 12 &&
      executed.unresolved.length === 0,
    `${executed.deviation?.amount} ${executed.symbolOut}, fee ${executed.gasNative} ETH, ${executed.secondsToConfirm}s`,
  );

  const better = analyzeExecution({
    amountIn: "1000",
    symbolIn: "USDC",
    symbolOut: "ETH",
    quotedAmountOut: "0.31",
    minAmountOut: "0.30",
    actualAmountOut: "0.315",
    gasUsed: null,
    gasLimit: "200000",
    route: "Uniswap V3, direct pool",
    effectiveGasPriceWei: null,
    nativeSymbol: "ETH",
    quotedAt: null,
    confirmedAt: null,
  });

  check(
    "getting more than quoted is not reported as a loss",
    better.deviation?.amount === "0.005" &&
      better.deviation.worseThanQuote === false,
    `${better.deviation?.amount} ${better.symbolOut}`,
  );

  const unknown = analyzeExecution({
    amountIn: "1000",
    symbolIn: "USDC",
    symbolOut: "ETH",
    quotedAmountOut: "0.31",
    minAmountOut: "0.30",
    actualAmountOut: null,
    gasUsed: null,
    gasLimit: "200000",
    route: "Uniswap V3, direct pool",
    effectiveGasPriceWei: null,
    nativeSymbol: "ETH",
    quotedAt: null,
    confirmedAt: null,
  });

  check(
    "when the chain has not said what arrived, no number is invented",
    unknown.received === null &&
      unknown.deviation === null &&
      unknown.unresolved.includes("what actually arrived"),
    `unresolved: ${unknown.unresolved.join(", ")}`,
  );

  function slowStore(initial: string | null = null) {
    let value = initial;

    let reads = 0;

    return {
      reads: () => reads,

      value: () => value,

      store: {
        async read() {
          reads += 1;

          await new Promise((resolve) => setTimeout(resolve, 5));

          return value;
        },

        async write(next: string) {
          await new Promise((resolve) => setTimeout(resolve, 5));

          value = next;
        },
      },
    };
  }

  let clock = 1_000_000;

  const twoAtOnce = slowStore();

  const guardA = createOutflowGuard({
    store: twoAtOnce.store,
    now: () => clock,
  });

  const bothSixHundred = await Promise.all([
    guardA.checkAndReserve({
      id: "a",
      amountUsd: 600,
      limitUsd: 1000,
      spentTodayUsd: async () => 0,
    }),

    guardA.checkAndReserve({
      id: "b",
      amountUsd: 600,
      limitUsd: 1000,
      spentTodayUsd: async () => 0,
    }),
  ]);

  check(
    "two simultaneous $600 transfers against a $1000 daily limit: exactly one passes",
    bothSixHundred.filter((result) => result.ok).length === 1,
    `passed: ${bothSixHundred.filter((result) => result.ok).length}`,
  );

  const fiveAtOnce = slowStore();

  const guardB = createOutflowGuard({
    store: fiveAtOnce.store,
    now: () => clock,
  });

  const fiveQuarters = await Promise.all(
    [1, 2, 3, 4, 5].map((index) =>
      guardB.checkAndReserve({
        id: `q${index}`,
        amountUsd: 250,
        limitUsd: 1000,
        spentTodayUsd: async () => 0,
      }),
    ),
  );

  check(
    "five simultaneous $250 transfers against a $1000 limit: no more than four pass",
    fiveQuarters.filter((result) => result.ok).length === 4,
    `passed: ${fiveQuarters.filter((result) => result.ok).length}`,
  );

  const withPending = slowStore();

  const guardC = createOutflowGuard({
    store: withPending.store,
    now: () => clock,
  });

  const afterPending = await guardC.checkAndReserve({
    id: "new",
    amountUsd: 400,
    limitUsd: 1000,
    spentTodayUsd: async () => 700,
  });

  check(
    "a $400 transfer is refused while $700 is already spent or waiting",
    afterPending.ok === false,
    afterPending.ok === false
      ? `would reach $${afterPending.wouldTotalUsd}`
      : "passed",
  );

  const releasing = slowStore();

  const guardD = createOutflowGuard({
    store: releasing.store,
    now: () => clock,
  });

  await guardD.checkAndReserve({
    id: "doomed",
    amountUsd: 700,
    limitUsd: 1000,
    spentTodayUsd: async () => 0,
  });

  const blockedWhileHeld = await guardD.checkAndReserve({
    id: "next",
    amountUsd: 400,
    limitUsd: 1000,
    spentTodayUsd: async () => 0,
  });

  await guardD.release("doomed");

  const allowedAfterRelease = await guardD.checkAndReserve({
    id: "next",
    amountUsd: 400,
    limitUsd: 1000,
    spentTodayUsd: async () => 0,
  });

  check(
    "a signature that never went out frees its hold, and the next transfer goes through",
    blockedWhileHeld.ok === false && allowedAfterRelease.ok === true,
    `held: ${blockedWhileHeld.ok ? "passed" : "blocked"}, after release: ${allowedAfterRelease.ok ? "passed" : "blocked"}`,
  );

  const crashed = slowStore();

  const guardE = createOutflowGuard({
    store: crashed.store,
    now: () => clock,
    ttlMs: 60_000,
  });

  await guardE.checkAndReserve({
    id: "orphan",
    amountUsd: 900,
    limitUsd: 1000,
    spentTodayUsd: async () => 0,
  });

  const restarted = createOutflowGuard({
    store: crashed.store,
    now: () => clock,
    ttlMs: 60_000,
  });

  const stillHeld = await restarted.checkAndReserve({
    id: "after-restart",
    amountUsd: 200,
    limitUsd: 1000,
    spentTodayUsd: async () => 0,
  });

  clock += 61_000;

  const reconciled = await restarted.reconcile();

  const afterReconcile = await restarted.checkAndReserve({
    id: "after-reconcile",
    amountUsd: 200,
    limitUsd: 1000,
    spentTodayUsd: async () => 0,
  });

  check(
    "a hold that survived a crash still counts, and is only released once it goes stale",
    stillHeld.ok === false &&
      reconciled.length === 0 &&
      afterReconcile.ok === true,
    `held after restart: ${stillHeld.ok ? "no" : "yes"}, left after reconcile: ${reconciled.length}`,
  );

  const noLimit = slowStore();

  const guardF = createOutflowGuard({
    store: noLimit.store,
    now: () => clock,
  });

  const unlimited = await guardF.checkAndReserve({
    id: "free",
    amountUsd: 999_999,
    limitUsd: null,
    spentTodayUsd: async () => 0,
  });

  check(
    "with no daily limit set nothing is reserved and nothing is refused",
    unlimited.ok === true &&
      unlimited.reserved === false &&
      noLimit.value() === null,
    `stored: ${String(noLimit.value())}`,
  );

  const racingSpend = slowStore();

  const guardG = createOutflowGuard({
    store: racingSpend.store,
    now: () => clock,
  });

  const order: string[] = [];

  let spentSoFar = 0;

  const firstInFlight = guardG
    .checkAndReserve({
      id: "r1",
      amountUsd: 900,
      limitUsd: 1000,
      spentTodayUsd: async () => {
        order.push("first reads the day");

        return spentSoFar;
      },
    })
    .then(async () => {
      spentSoFar = 900;

      order.push("first is broadcast and recorded");

      await guardG.release("r1");
    });

  const secondResult = await guardG.checkAndReserve({
    id: "r2",
    amountUsd: 900,
    limitUsd: 1000,
    spentTodayUsd: async () => {
      order.push("second reads the day");

      return spentSoFar;
    },
  });

  await firstInFlight;

  check(
    "the day's spending is read inside the lock, after everything queued ahead has finished",
    order.join(" → ") ===
      "first reads the day → first is broadcast and recorded → second reads the day" &&
      secondResult.ok === false,
    `${order.join(" → ")}; second ${secondResult.ok ? "passed" : "blocked"}`,
  );

  const corrupted = slowStore('[{"id":"held","amountUsd":800,"createdAt":');

  const guardH = createOutflowGuard({
    store: corrupted.store,
    now: () => clock,
  });

  let corruptError: unknown = null;

  try {
    await guardH.checkAndReserve({
      id: "after-corruption",
      amountUsd: 900,
      limitUsd: 1000,
      spentTodayUsd: async () => 0,
    });
  } catch (error) {
    corruptError = error;
  }

  check(
    "a reservation file that cannot be read refuses the transfer instead of forgetting the hold",
    corruptError instanceof ReservationStateError &&
      corrupted.value() === '[{"id":"held","amountUsd":800,"createdAt":',
    corruptError instanceof Error ? corruptError.name : "nothing thrown",
  );

  const notAnArray = slowStore('{"note":"not an array"}');

  const guardI = createOutflowGuard({
    store: notAnArray.store,
    now: () => clock,
  });

  let shapeError: unknown = null;

  try {
    await guardI.reservedUsd();
  } catch (error) {
    shapeError = error;
  }

  check(
    "a reservation file of the wrong shape is refused, not treated as empty",
    shapeError instanceof ReservationStateError,
    shapeError instanceof Error ? shapeError.name : "nothing thrown",
  );

  const junkEntries = slowStore('[{"id":"x","amountUsd":"800","createdAt":0}]');

  const guardJ = createOutflowGuard({
    store: junkEntries.store,
    now: () => clock,
  });

  let junkError: unknown = null;

  try {
    await guardJ.reservedUsd();
  } catch (error) {
    junkError = error;
  }

  check(
    "a hold whose amount is not a number is refused, not silently dropped",
    junkError instanceof ReservationStateError,
    junkError instanceof Error ? junkError.name : "nothing thrown",
  );

  const moneyStore = slowStore();

  const guardK = createOutflowGuard({
    store: moneyStore.store,
    now: () => clock,
  });

  const hostileMoney = await Promise.all(
    [
      { label: "NaN", amountUsd: Number.NaN, spent: 0, limit: 1000 },
      { label: "Infinity", amountUsd: Number.POSITIVE_INFINITY, spent: 0, limit: 1000 },
      { label: "-Infinity", amountUsd: Number.NEGATIVE_INFINITY, spent: 0, limit: 1000 },
      { label: "negative", amountUsd: -1000, spent: 0, limit: 1000 },
      { label: "string", amountUsd: "500" as unknown as number, spent: 0, limit: 1000 },
      { label: "spent NaN", amountUsd: 100, spent: Number.NaN, limit: 1000 },
      { label: "spent negative", amountUsd: 100, spent: -100000, limit: 1000 },
      { label: "limit NaN", amountUsd: 100, spent: 0, limit: Number.NaN },
    ].map((probe) =>
      guardK
        .checkAndReserve({
          id: `money-${probe.label}`,
          amountUsd: probe.amountUsd,
          limitUsd: probe.limit,
          spentTodayUsd: async () => probe.spent,
        })
        .then((result) => ({ label: probe.label, result })),
    ),
  );

  check(
    "no unusable number can open the daily limit",
    hostileMoney.every((probe) => probe.result.ok === false) &&
      moneyStore.value() === null,
    hostileMoney
      .filter((probe) => probe.result.ok)
      .map((probe) => probe.label)
      .join(", ") || "all eight refused, nothing written",
  );

  const duplicateStore = slowStore();

  const guardL = createOutflowGuard({
    store: duplicateStore.store,
    now: () => clock,
  });

  const firstHold = await guardL.checkAndReserve({
    id: "same",
    amountUsd: 500,
    limitUsd: 1000,
    spentTodayUsd: async () => 0,
  });

  const secondHold = await guardL.checkAndReserve({
    id: "same",
    amountUsd: 500,
    limitUsd: 1000,
    spentTodayUsd: async () => 0,
  });

  await guardL.release("same");

  check(
    "the same hold cannot be taken twice, so releasing it cannot free money that was never held",
    firstHold.ok === true &&
      secondHold.ok === false &&
      (await guardL.reservedUsd()) === 0,
    secondHold.ok === false ? secondHold.reason : "second hold passed",
  );

  const futureStore = slowStore(
    JSON.stringify([
      { id: "future", amountUsd: 900, createdAt: clock + 600_000 },
    ]),
  );

  const guardM = createOutflowGuard({
    store: futureStore.store,
    now: () => clock,
    ttlMs: 60_000,
  });

  const afterClamp = await guardM.reconcile();

  check(
    "a hold stamped in the future is pulled back to now instead of living forever",
    afterClamp.length === 1 && afterClamp[0].createdAt === clock,
    `createdAt ${afterClamp[0]?.createdAt} vs now ${clock}`,
  );

  const lifecycleStages: {
    stage: string;
    reservationHeld: boolean;
    trackedStatus: TrackedTransactionStatus | null;
  }[] = [
    { stage: "reserved, not yet signed", reservationHeld: true, trackedStatus: null },
    { stage: "signed, nothing written yet", reservationHeld: true, trackedStatus: null },
    {
      stage: "written before broadcast",
      reservationHeld: true,
      trackedStatus: "broadcast-pending",
    },
    {
      stage: "hold released, waiting for the node",
      reservationHeld: false,
      trackedStatus: "broadcast-pending",
    },
    {
      stage: "node never answered",
      reservationHeld: false,
      trackedStatus: "broadcast-unknown",
    },
    { stage: "accepted by the node", reservationHeld: false, trackedStatus: "pending" },
    { stage: "mined", reservationHeld: false, trackedStatus: "confirmed" },
  ];

  const uncounted = lifecycleStages.filter(
    (stage) =>
      !stage.reservationHeld &&
      (stage.trackedStatus === null ||
        !countsAgainstOutflow(stage.trackedStatus)),
  );

  check(
    "at every stage between authorization and the chain, the amount is counted somewhere",
    uncounted.length === 0,
    uncounted.length === 0
      ? lifecycleStages.length + " stages, none of them lose the amount"
      : `lost at: ${uncounted.map((stage) => stage.stage).join(", ")}`,
  );

  check(
    "a transfer that reverted on chain stops counting, everything else keeps counting",
    countsAgainstOutflow("reverted") === false &&
      countsAgainstOutflow("broadcast-pending") &&
      countsAgainstOutflow("broadcast-unknown") &&
      countsAgainstOutflow("pending") &&
      countsAgainstOutflow("confirmed"),
    "only a reverted transfer is dropped from the day's outflow",
  );

  check(
    "a record written before broadcast is still chased for a receipt",
    isAwaitingChain("broadcast-pending") &&
      isAwaitingChain("broadcast-unknown") &&
      isAwaitingChain("pending") &&
      !isAwaitingChain("confirmed") &&
      !isAwaitingChain("reverted"),
    "reconciliation keeps looking until the chain answers",
  );

  const lockedAt = 5_000_000;

  const lockdown = createFreeze(lockedAt);

  check(
    "lockdown blocks signing and has no early exit until one is asked for",
    isFrozen(lockdown, lockedAt + 60_000) &&
      canUnfreezeNow(lockdown, lockedAt + 60_000) === false &&
      unfreezeReadyInMs(lockdown, lockedAt + 60_000) ===
        Number.POSITIVE_INFINITY,
    "no unlock is pending until the owner asks",
  );

  const asked = requestUnfreeze(lockdown, lockedAt + 60_000);

  check(
    "asking for an early unlock starts a cooldown rather than unlocking",
    isFrozen(asked, lockedAt + 60_000) &&
      canUnfreezeNow(asked, lockedAt + 60_000) === false &&
      unfreezeReadyInMs(asked, lockedAt + 60_000) === UNFREEZE_COOLDOWN_MS,
    `${describeRemaining(unfreezeReadyInMs(asked, lockedAt + 60_000))} to wait`,
  );

  check(
    "the early unlock opens only after the cooldown, and asking again does not restart it",
    canUnfreezeNow(asked, lockedAt + 60_000 + UNFREEZE_COOLDOWN_MS) &&
      canUnfreezeNow(
        requestUnfreeze(asked, lockedAt + 60_000 + UNFREEZE_COOLDOWN_MS),
        lockedAt + 60_000 + UNFREEZE_COOLDOWN_MS,
      ),
    "a second tap cannot push the cooldown further away",
  );

  const rewound = requestUnfreeze(
    advanceFreeze(asked, lockedAt + 60_000 + UNFREEZE_COOLDOWN_MS / 2),
    lockedAt - 1_000_000,
  );

  check(
    "winding the clock back does not open the early unlock sooner",
    canUnfreezeNow(rewound, lockedAt - 1_000_000) === false,
    `${describeRemaining(unfreezeReadyInMs(rewound, lockedAt - 1_000_000))} still to wait`,
  );

  const lockdownAfterDay = advanceFreeze(
    lockdown,
    lockedAt + FREEZE_DURATION_MS + 1,
  );

  check(
    "lockdown still clears itself after a day without anyone asking",
    isFrozen(lockdownAfterDay, lockedAt + FREEZE_DURATION_MS + 1) === false,
    "waiting it out remains an option",
  );

  const crashedBeforeRpc = resolveBroadcast({
    receipt: null,
    transactionSeen: false,
    accountNonce: 7,
    txNonce: 7,
    hasSignedTransaction: true,
  });

  check(
    "a crash before the node was ever called resends the very same signed bytes",
    crashedBeforeRpc.action === "rebroadcast",
    `resolution: ${crashedBeforeRpc.action}`,
  );

  const answerLost = resolveBroadcast({
    receipt: null,
    transactionSeen: true,
    accountNonce: 7,
    txNonce: 7,
    hasSignedTransaction: true,
  });

  check(
    "a transaction the node already has is tracked, not sent a second time",
    answerLost.action === "mark-pending",
    `resolution: ${answerLost.action}`,
  );

  const stillWaiting = resolveBroadcast({
    receipt: null,
    transactionSeen: false,
    accountNonce: 7,
    txNonce: 7,
    hasSignedTransaction: true,
  });

  check(
    "a missing transaction whose nonce is still unused is retried, not written off",
    stillWaiting.action === "rebroadcast",
    "the account nonce has not moved past it",
  );

  const superseded = resolveBroadcast({
    receipt: null,
    transactionSeen: false,
    accountNonce: 9,
    txNonce: 7,
    hasSignedTransaction: true,
  });

  check(
    "a transaction whose nonce was used by something else can never run, and stops counting",
    superseded.action === "supersede" && countsAgainstOutflow("reverted") === false,
    "the account moved past its nonce",
  );

  const mined = resolveBroadcast({
    receipt: "success",
    transactionSeen: true,
    accountNonce: 9,
    txNonce: 7,
    hasSignedTransaction: true,
  });

  const minedAndFailed = resolveBroadcast({
    receipt: "reverted",
    transactionSeen: true,
    accountNonce: 9,
    txNonce: 7,
    hasSignedTransaction: true,
  });

  check(
    "once the chain has a receipt nothing is ever resent",
    mined.action === "confirm" &&
      mined.status === "confirmed" &&
      minedAndFailed.action === "confirm" &&
      minedAndFailed.status === "reverted",
    "a receipt is the end of the line",
  );

  const nothingToResend = resolveBroadcast({
    receipt: null,
    transactionSeen: false,
    accountNonce: 7,
    txNonce: 7,
    hasSignedTransaction: false,
  });

  check(
    "without the signed bytes the record waits instead of guessing",
    nothingToResend.action === "wait",
    `resolution: ${nothingToResend.action}`,
  );

  const unknownNonce = resolveBroadcast({
    receipt: null,
    transactionSeen: false,
    accountNonce: null,
    txNonce: null,
    hasSignedTransaction: true,
  });

  check(
    "an unreadable nonce never writes a transfer off as dead",
    unknownNonce.action === "rebroadcast",
    "silence about the nonce is not proof it can never run",
  );

  const liveQuotedAt = 1_786_000_000_000;

  const liveSwap = analyzeExecution({
    amountIn: "0.001",
    symbolIn: "ETH",
    symbolOut: "USDC",
    quotedAmountOut: "25.247581",
    minAmountOut: "25.121343",
    actualAmountOut: "25.247581",
    gasUsed: "117610",
    gasLimit: "142029",
    route: "Uniswap V3, direct pool",
    effectiveGasPriceWei: "1086250165",
    nativeSymbol: "ETH",
    quotedAt: liveQuotedAt,
    confirmedAt: liveQuotedAt + 21_000,
  });

  check(
    "the real Sepolia swap reads back as a complete report with nothing unresolved",
    liveSwap.received === "25.247581" &&
      liveSwap.provenance === "receipt-logs" &&
      liveSwap.deviation?.amount === "0" &&
      liveSwap.headroomOverFloor === "0.126238" &&
      liveSwap.gasNative === "0.00012775388190565" &&
      liveSwap.gasHeadroomPercent === 82.8 &&
      liveSwap.secondsToConfirm === 21 &&
      liveSwap.unresolved.length === 0,
    `price ${liveSwap.executionPrice} USDC per ETH, gas ${liveSwap.gasHeadroomPercent}% of the limit`,
  );

  check(
    "the price actually obtained is derived from what arrived, not from the quote",
    liveSwap.executionPrice === "25,247.581",
    `${liveSwap.executionPrice} USDC per ETH`,
  );

  const nativeOutSwap = analyzeExecution({
    amountIn: "25",
    symbolIn: "USDC",
    symbolOut: "ETH",
    quotedAmountOut: "0.00099",
    minAmountOut: "0.00098",
    actualAmountOut: null,
    gasUsed: "120000",
    gasLimit: "150000",
    route: "Uniswap V3, direct pool",
    effectiveGasPriceWei: "1000000000",
    nativeSymbol: "ETH",
    quotedAt: liveQuotedAt,
    confirmedAt: liveQuotedAt + 15_000,
  });

  check(
    "a swap that ends in native ETH says the output is not established instead of echoing the quote",
    nativeOutSwap.received === null &&
      nativeOutSwap.provenance === "not-established" &&
      nativeOutSwap.deviation === null &&
      nativeOutSwap.headroomOverFloor === null &&
      nativeOutSwap.unresolved.includes("what actually arrived") &&
      nativeOutSwap.executionPrice === null &&
      nativeOutSwap.gasNative === "0.00012",
    `provenance: ${nativeOutSwap.provenance}, price: ${String(nativeOutSwap.executionPrice)}, fee still known: ${nativeOutSwap.gasNative} ETH`,
  );

  const finishedStory = buildExecutionStory({
    kind: "swap",
    status: "confirmed",
    quotedAt: liveQuotedAt,
    broadcastAt: liveQuotedAt + 3_000,
    confirmedAt: liveQuotedAt + 21_000,
    blockNumber: "11486114",
    hash: "0xa0e8d155e997f94cd1d0a8d1e965b96b47bfc291d719df0f5d91a76a2e90d8e1",
  });

  check(
    "a finished operation reads as a story, in order, with the waiting time between steps",
    finishedStory.map((step) => step.id).join(" → ") ===
      "quoted → recorded → sent → mined" &&
      finishedStory.every((step) => step.state === "done") &&
      finishedStory[2].detail === "3s later" &&
      finishedStory[3].title === "Included in block 11486114" &&
      finishedStory[3].detail === "18s later",
    finishedStory.map((step) => step.title).join(" / "),
  );

  const stuckStory = buildExecutionStory({
    kind: "swap",
    status: "broadcast-pending",
    quotedAt: liveQuotedAt,
    broadcastAt: null,
    confirmedAt: null,
    blockNumber: null,
    hash: "0xdead",
  });

  const unknownStory = buildExecutionStory({
    kind: "swap",
    status: "broadcast-unknown",
    quotedAt: liveQuotedAt,
    broadcastAt: null,
    confirmedAt: null,
    blockNumber: null,
    hash: "0xdead",
  });

  check(
    "an operation still on its way says so plainly, and never claims it reached the chain",
    stuckStory[stuckStory.length - 1].state === "waiting" &&
      stuckStory.every((step) => step.id !== "mined") &&
      unknownStory[unknownStory.length - 1].state === "unknown" &&
      unknownStory[unknownStory.length - 1].detail?.includes(
        "keeps counting the amount as spent",
      ) === true,
    `${stuckStory[stuckStory.length - 1].title} / ${unknownStory[unknownStory.length - 1].title}`,
  );

  const failedStory = buildExecutionStory({
    kind: "swap",
    status: "reverted",
    quotedAt: liveQuotedAt,
    broadcastAt: liveQuotedAt + 2_000,
    confirmedAt: liveQuotedAt + 30_000,
    blockNumber: "999",
    hash: "0xdead",
  });

  check(
    "a call that failed on chain is told as a failure, not as a success",
    failedStory[failedStory.length - 1].state === "failed" &&
      failedStory[failedStory.length - 1].title ===
        "Included in a block, but the call failed",
    failedStory[failedStory.length - 1].title,
  );

  const supersededStory = buildExecutionStory({
    kind: "transfer",
    status: "superseded",
    quotedAt: liveQuotedAt,
    broadcastAt: null,
    confirmedAt: null,
    blockNumber: null,
    hash: "0xdead",
  });

  check(
    "a superseded transfer claims only what can be proven: its nonce was used by another transaction",
    supersededStory[supersededStory.length - 1].title ===
      "Superseded before confirmation" &&
      supersededStory.every((step) => !step.title.includes("block")) &&
      countsAgainstOutflow("superseded") === false,
    supersededStory[supersededStory.length - 1].detail ?? "",
  );

  check(
    "the word quoted only appears where a quote existed",
    buildExecutionStory({
      kind: "transfer",
      status: "confirmed",
      quotedAt: liveQuotedAt,
      broadcastAt: liveQuotedAt + 1000,
      confirmedAt: liveQuotedAt + 5000,
      blockNumber: "1",
      hash: "0x1",
    })[0].title === "Signed on this device" &&
      buildExecutionStory({
        kind: "approve",
        status: "confirmed",
        quotedAt: liveQuotedAt,
        broadcastAt: liveQuotedAt + 1000,
        confirmedAt: liveQuotedAt + 5000,
        blockNumber: "1",
        hash: "0x1",
      })[0].title === "Permission signed" &&
      buildExecutionStory({
        kind: "swap",
        status: "confirmed",
        quotedAt: liveQuotedAt,
        broadcastAt: liveQuotedAt + 1000,
        confirmedAt: liveQuotedAt + 5000,
        blockNumber: "1",
        hash: "0x1",
      })[0].title === "Quoted and signed",
    "a plain transfer is never described as quoted",
  );

  const unfinishedSwap = executionFromTracked(
    {
      assetType: "swap",
      status: "pending",
      symbol: "ETH",
      symbolOut: "USDC",
      valueWei: "1000000000000000",
      tokenDecimals: 18,
      valueOutWei: "25247581",
      minAmountOutWei: "25121343",
      actualAmountOutWei: null,
      tokenOutDecimals: 6,
      gasUsed: null,
      gasLimit: null,
      routeLabel: null,
      effectiveGasPriceWei: null,
      createdAt: liveQuotedAt,
      confirmedAt: null,
    },
    "ETH",
  );

  const namelessSwap = executionFromTracked(
    {
      assetType: "swap",
      status: "confirmed",
      symbol: "ETH",
      symbolOut: undefined,
      valueWei: "1000000000000000",
      tokenDecimals: 18,
      valueOutWei: "25247581",
      minAmountOutWei: "25121343",
      actualAmountOutWei: "25247581",
      tokenOutDecimals: 6,
      gasUsed: "117610",
      gasLimit: "142029",
      routeLabel: null,
      effectiveGasPriceWei: "1086250165",
      createdAt: liveQuotedAt,
      confirmedAt: liveQuotedAt + 21_000,
    },
    "ETH",
  );

  check(
    "no execution report is shown before the chain has answered, or without knowing the token",
    unfinishedSwap === null && namelessSwap === null,
    "an unfinished or nameless swap gets no report instead of a report full of blanks",
  );

  check(
    "a block stamped earlier than the quote shows no elapsed time rather than a negative one",
    quoteToBlockSeconds(liveQuotedAt, liveQuotedAt - 4_000) === null &&
      quoteToBlockSeconds(liveQuotedAt, liveQuotedAt + 21_000) === 21 &&
      quoteToBlockSeconds(liveQuotedAt, liveQuotedAt) === 0 &&
      quoteToBlockSeconds(null, liveQuotedAt) === null,
    "the device clock and the network clock are not the same clock",
  );

  const skewedStory = buildExecutionStory({
    kind: "swap",
    status: "confirmed",
    quotedAt: liveQuotedAt,
    broadcastAt: liveQuotedAt - 4_000,
    confirmedAt: liveQuotedAt - 2_000,
    blockNumber: "1",
    hash: "0x1",
  });

  check(
    "a skewed clock never puts a negative wait into the story",
    skewedStory.every(
      (step) => step.detail === null || !step.detail.startsWith("-"),
    ),
    skewedStory
      .map((step) => step.detail ?? "no timing")
      .join(" / "),
  );

  check(
    "the record says nothing about a device losing its storage",
    buildExecutionStory({
      kind: "swap",
      status: "confirmed",
      quotedAt: liveQuotedAt,
      broadcastAt: liveQuotedAt + 1000,
      confirmedAt: liveQuotedAt + 2000,
      blockNumber: "1",
      hash: "0x1",
    })[1].detail === "Saved before the transaction was sent.",
    "no promise that a local record cannot be lost",
  );

  const TOKEN_A = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

  const TOKEN_B = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";

  const chainId = 11155111;

  const unavailableProviders = {
    goplus: {
      status: "unavailable" as const,
      attemptedAt: 1,
      reason: "network",
    },
    honeypotCheck: {
      status: "unavailable" as const,
      attemptedAt: 1,
      reason: "network",
    },
    honeypotTopHolders: {
      status: "unavailable" as const,
      attemptedAt: 1,
      reason: "network",
    },
  };

  const blindIntelligence = buildTokenIntelligence({
    token: { chainId, address: TOKEN_A, symbol: "AAA", name: "Token A" },
    providers: unavailableProviders,
    now: 1_000,
  });

  check(
    "a trade check that could not be refreshed still demands a briefing",
    requiresTradeBriefing(blindIntelligence) &&
      blindIntelligence.availability.trade !== "available",
    `trade availability: ${blindIntelligence.availability.trade}, summary: ${blindIntelligence.summary.kind}`,
  );

  const quietButBlind = {
    ...blindIntelligence,
    summary: { ...blindIntelligence.summary, kind: "no-major-issues" as const },
    evidence: { conflicts: [] },
  };

  check(
    "a clean-looking token whose trade data could not be read is still briefed, never waved through",
    requiresTradeBriefing(quietButBlind),
    `summary says ${quietButBlind.summary.kind} but trade data is ${quietButBlind.availability.trade}`,
  );

  check(
    "nothing is prepared for a token that was never briefed",
    decideTradeGate({
      target: { chainId, address: TOKEN_A },
      briefed: null,
    }).proceed === false,
    "no briefing, no preparation",
  );

  const cancelled = decideTradeGate({
    target: { chainId, address: TOKEN_A },
    briefed: { target: { chainId, address: TOKEN_A }, acknowledged: false },
  });

  check(
    "cancelling the briefing stops the swap before anything is prepared or signed",
    cancelled.proceed === false &&
      cancelled.reason === "briefing-not-acknowledged",
    `refused with: ${cancelled.reason}`,
  );

  const swapped = decideTradeGate({
    target: { chainId, address: TOKEN_B },
    briefed: { target: { chainId, address: TOKEN_A }, acknowledged: true },
  });

  check(
    "a briefing for one token can never wave through a swap into another",
    swapped.proceed === false &&
      swapped.reason === "briefing-for-another-token" &&
      describeTradeGate(swapped)?.includes("different token") === true,
    `refused with: ${swapped.reason}`,
  );

  const otherChain = decideTradeGate({
    target: { chainId: 1, address: TOKEN_A },
    briefed: { target: { chainId, address: TOKEN_A }, acknowledged: true },
  });

  check(
    "the same address on another network is not the same token",
    otherChain.proceed === false,
    `refused with: ${otherChain.reason}`,
  );

  check(
    "an acknowledged briefing for this exact token lets preparation start",
    decideTradeGate({
      target: { chainId, address: TOKEN_A.toLowerCase() },
      briefed: { target: { chainId, address: TOKEN_A }, acknowledged: true },
    }).proceed === true &&
      decideTradeGate({
        target: { chainId, address: null },
        briefed: null,
      }).proceed === true,
    "case of the address is display, not identity; native ETH has no token to brief",
  );

  check(
    "the token being sold is checked too, not only the token being bought",
    tradeTargets({
      sold: { chainId, address: TOKEN_A },
      bought: { chainId, address: null },
    }).length === 1 &&
      tradeTargets({
        sold: { chainId, address: TOKEN_A },
        bought: { chainId, address: TOKEN_B },
      }).length === 2 &&
      tradeTargets({
        sold: { chainId, address: null },
        bought: { chainId, address: null },
      }).length === 0,
    "selling a token into ETH is still a trade in that token",
  );

  check(
    "selling a token nobody briefed is refused, even when the wallet buys plain ETH",
    decideTradeGateForAll({
      targets: tradeTargets({
        sold: { chainId, address: TOKEN_A },
        bought: { chainId, address: null },
      }),
      cleared: [],
    }).proceed === false,
    "the honeypot you are trying to escape is on the paying side",
  );

  check(
    "clearing one side of a trade does not clear the other",
    decideTradeGateForAll({
      targets: tradeTargets({
        sold: { chainId, address: TOKEN_A },
        bought: { chainId, address: TOKEN_B },
      }),
      cleared: [
        { target: { chainId, address: TOKEN_B }, acknowledged: true },
      ],
    }).proceed === false &&
      decideTradeGateForAll({
        targets: tradeTargets({
          sold: { chainId, address: TOKEN_A },
          bought: { chainId, address: TOKEN_B },
        }),
        cleared: [
          { target: { chainId, address: TOKEN_A }, acknowledged: true },
          { target: { chainId, address: TOKEN_B }, acknowledged: true },
        ],
      }).proceed === true,
    "both sides have to be checked before anything is prepared",
  );

  const outOfCoverageIntelligence = {
    ...blindIntelligence,
    summary: { ...blindIntelligence.summary, kind: "no-major-issues" as const },
    evidence: { conflicts: [] },
    availability: {
      ...blindIntelligence.availability,
      trade: "unsupported" as const,
      contract: "unsupported" as const,
    },
  };

  check(
    "a network the checks do not cover at all is not turned into a click-through screen",
    requiresTradeBriefing(outOfCoverageIntelligence) === false &&
      outOfCoverage(outOfCoverageIntelligence) &&
      requiresTradeBriefing(quietButBlind),
    "unsupported network is stated once, not asked about before every swap; unavailable data still stops the flow",
  );

  const briefedSwap = executionFromTracked(
    {
      assetType: "swap",
      status: "confirmed",
      symbol: "ETH",
      symbolOut: "USDC",
      valueWei: "1000000000000000",
      tokenDecimals: 18,
      valueOutWei: "25247581",
      minAmountOutWei: "25121343",
      actualAmountOutWei: "25247581",
      tokenOutDecimals: 6,
      gasUsed: "117610",
      gasLimit: "142029",
      routeLabel: "Uniswap V3, direct pool",
      effectiveGasPriceWei: "1086250165",
      quotedAt: liveQuotedAt,
      createdAt: liveQuotedAt + 120_000,
      confirmedAt: liveQuotedAt + 141_000,
    },
    "ETH",
  );

  check(
    "time spent reading the token briefing counts against the quote, not against execution",
    briefedSwap?.secondsToConfirm === 141,
    `${briefedSwap?.secondsToConfirm}s from the quote, not 21s from the ledger write`,
  );

  const approveExecution = executionFromTracked(
    {
      assetType: "approve",
      status: "confirmed",
      symbol: "USDC",
      valueWei: "1000000",
      tokenDecimals: 6,
      gasUsed: "46000",
      gasLimit: "60000",
      effectiveGasPriceWei: "1000000000",
      createdAt: liveQuotedAt,
      confirmedAt: liveQuotedAt + 10_000,
    },
    "ETH",
  );

  check(
    "an approval never gets a swap execution report attached to it",
    approveExecution === null,
    "quote, floor, received and execution price belong to the trade, not to the permission",
  );

  const legacyStore = createMemoryStorage();

  const legacyPhrase = generated.mnemonic;

  await legacyStore.set("wallet.mnemonic.v1", legacyPhrase);

  const migratingMap = new Map<string, WalletSecret>();

  let vaultIsOpen = false;

  const migratingSecrets: SecretStore = {
    async load(walletId) {
      return migratingMap.get(walletId) ?? null;
    },

    async save(walletId, secret) {
      migratingMap.set(walletId, secret);

      return { durable: vaultIsOpen };
    },

    async remove(walletId) {
      migratingMap.delete(walletId);
    },
  };

  const legacyEngine = createWalletEngine({
    storage: legacyStore,
    secrets: migratingSecrets,
    random: nodeRandom,
  });

  await legacyEngine.initialize();

  check(
    "a legacy wallet keeps its only durable copy of the phrase until the vault can seal it",
    (await legacyStore.get("wallet.mnemonic.v1")) === legacyPhrase &&
      (await legacyEngine.list()).length === 1,
    "before the PIN is set, the plaintext legacy copy is the only durable source and is not deleted",
  );

  vaultIsOpen = true;

  await legacyEngine.finishLegacyMigration();

  check(
    "once the vault is open the phrase is sealed and only then is the plaintext copy removed",
    (await legacyStore.get("wallet.mnemonic.v1")) === null &&
      migratingMap.size === 1,
    "no window where the phrase exists nowhere durable",
  );

  // ---- Permission Graph: event-based spender discovery ----------------------
  //
  // The scan must find spenders the known list never named, treat the current
  // on-chain allowance as the only truth, resume incrementally after a reorg,
  // and never dress up a half-read history as a clean result.
  {
    const DTOKEN = "0x1111111111111111111111111111111111111111" as Address;

    const DTOKEN2 = "0x4444444444444444444444444444444444444444" as Address;

    const DUNKNOWN = "0x2222222222222222222222222222222222222222" as Address;

    const DROUTER = ROUTER as Address; // a known mainnet spender

    const dOwner = generated.address;

    const pairOf = (token: string, spender: string) =>
      `${token.toLowerCase()}|${spender.toLowerCase()}`;

    // A fake chain: fixed head, canned Approval logs per window, optional
    // failure for a given window. Records every window it was asked to read.
    const pgDiscovery = (config: {
      latest: bigint;
      logs?: (range: ScanRange) => ApprovalLogRecord[];
      failOn?: (range: ScanRange) => boolean;
    }) => {
      const calls: ScanRange[] = [];

      return {
        calls,

        async getLatestBlock() {
          return config.latest;
        },

        async getApprovalLogs(_owner: Address, range: ScanRange) {
          calls.push(range);

          if (config.failOn?.(range)) {
            throw new Error("rpc window unread");
          }

          return config.logs?.(range) ?? [];
        },
      };
    };

    // A fake allowance reader keyed by `${token}|${spender}` → bigint or "fail".
    const pgClient = (byPair: Record<string, bigint | "fail">) =>
      ({
        async multicall({
          contracts,
        }: {
          contracts: { address: string; args: readonly unknown[] }[];
        }) {
          return contracts.map((call) => {
            const address = String(call.address).toLowerCase();

            if (address === PERMIT2.toLowerCase()) {
              return { status: "success" as const, result: [0n, 0, 0] as const };
            }

            const spender = String(call.args[1]).toLowerCase();

            const value = byPair[`${address}|${spender}`];

            if (value === "fail") {
              return {
                status: "failure" as const,
                error: new Error("read fail"),
              };
            }

            return { status: "success" as const, result: value ?? 0n };
          });
        },
      }) as unknown as Parameters<typeof getApprovals>[3];

    const discovered = await scanApprovalGraph({
      owner: dOwner,
      assets: [],
      networkId: MAINNET,
      client: pgClient({ [pairOf(DTOKEN, DUNKNOWN)]: 5n }),
      storage: createMemoryStorage(),
      discovery: pgDiscovery({
        latest: 1000n,
        logs: () => [{ token: DTOKEN, spender: DUNKNOWN }],
      }),
    });

    const unknownRow = discovered.approvals.find(
      (row) => row.spender.toLowerCase() === DUNKNOWN.toLowerCase(),
    );

    check(
      "an approval to a spender outside the known list is discovered from history and shown",
      !!unknownRow && discovered.coverage === "complete",
      unknownRow ? `found ${unknownRow.spenderName}` : "unknown spender missing",
    );

    check(
      "a discovered unknown spender is scored on its real (unknown) identity, not assumed known",
      unknownRow?.risk === "critical",
      `risk ${unknownRow?.risk}`,
    );

    const knownDiscovered = await scanApprovalGraph({
      owner: dOwner,
      assets: [],
      networkId: MAINNET,
      client: pgClient({ [pairOf(DTOKEN, DROUTER)]: 5n }),
      storage: createMemoryStorage(),
      discovery: pgDiscovery({
        latest: 1000n,
        logs: () => [{ token: DTOKEN, spender: DROUTER }],
      }),
    });

    const knownRow = knownDiscovered.approvals.find(
      (row) => row.spender.toLowerCase() === DROUTER.toLowerCase(),
    );

    check(
      "a discovered spender that IS on the known list is labelled and scored as known, not critical",
      knownRow?.spenderName !== "Unknown contract" && knownRow?.risk === "medium",
      `name ${knownRow?.spenderName}, risk ${knownRow?.risk}`,
    );

    check(
      "the scan counts how many active permissions are to unrecognised contracts",
      discovered.unknownSpenderCount === 1 &&
        knownDiscovered.unknownSpenderCount === 0,
      `unknown counts ${discovered.unknownSpenderCount} / ${knownDiscovered.unknownSpenderCount}`,
    );

    const revoked = await scanApprovalGraph({
      owner: dOwner,
      assets: [],
      networkId: MAINNET,
      client: pgClient({ [pairOf(DTOKEN, DUNKNOWN)]: 0n }),
      storage: createMemoryStorage(),
      discovery: pgDiscovery({
        latest: 1000n,
        logs: () => [{ token: DTOKEN, spender: DUNKNOWN }],
      }),
    });

    check(
      "an approval history shows but the chain now reports as zero is not an active permission",
      revoked.approvals.every(
        (row) => row.spender.toLowerCase() !== DUNKNOWN.toLowerCase(),
      ),
      `rows ${revoked.approvals.length}`,
    );

    const repeated = await scanApprovalGraph({
      owner: dOwner,
      assets: [],
      networkId: MAINNET,
      client: pgClient({ [pairOf(DTOKEN, DUNKNOWN)]: 5n }),
      storage: createMemoryStorage(),
      discovery: pgDiscovery({
        latest: 1000n,
        logs: () => [
          { token: DTOKEN, spender: DUNKNOWN },
          { token: DTOKEN, spender: DUNKNOWN },
          { token: DTOKEN, spender: DUNKNOWN },
        ],
      }),
    });

    check(
      "the same spender approved many times is one current permission, not many",
      repeated.approvals.filter(
        (row) => row.spender.toLowerCase() === DUNKNOWN.toLowerCase(),
      ).length === 1,
      `rows ${repeated.approvals.length}`,
    );

    const unreadable = await scanApprovalGraph({
      owner: dOwner,
      assets: [],
      networkId: MAINNET,
      client: pgClient({ [pairOf(DTOKEN, DUNKNOWN)]: "fail" }),
      storage: createMemoryStorage(),
      discovery: pgDiscovery({
        latest: 1000n,
        logs: () => [{ token: DTOKEN, spender: DUNKNOWN }],
      }),
    });

    const uncertainRow = unreadable.approvals.find(
      (row) => row.spender.toLowerCase() === DUNKNOWN.toLowerCase(),
    );

    check(
      "a discovered permission whose current allowance cannot be read is shown as uncertain, never silently zero",
      !!uncertainRow &&
        uncertainRow.allowanceCertain === false &&
        unreadable.uncertainCount >= 1,
      uncertainRow
        ? `certain=${uncertainRow.allowanceCertain}`
        : "row dropped (silently zeroed)",
    );

    const halfDeadStorage = createMemoryStorage();

    const halfDead = await scanApprovalGraph({
      owner: dOwner,
      assets: [],
      networkId: MAINNET,
      client: pgClient({}),
      storage: halfDeadStorage,
      discovery: pgDiscovery({
        latest: 1_500_000n,
        failOn: (range) => range.fromBlock === 500_000n,
      }),
      chunkSize: 500_000n,
    });

    check(
      "when a slice of history cannot be read the scan reports partial coverage, not a clean result",
      halfDead.coverage === "partial",
      `coverage ${halfDead.coverage}`,
    );

    const resumeAfterGap = pgDiscovery({ latest: 1_500_050n });

    await scanApprovalGraph({
      owner: dOwner,
      assets: [],
      networkId: MAINNET,
      client: pgClient({}),
      storage: halfDeadStorage,
      discovery: resumeAfterGap,
      chunkSize: 500_000n,
    });

    check(
      "after a partial scan the next run resumes at the last fully-read block, retrying the gap not skipping it",
      resumeAfterGap.calls[0]?.fromBlock === 499_999n - 12n,
      `resumed from ${resumeAfterGap.calls[0]?.fromBlock}`,
    );

    const restartStorage = createMemoryStorage();

    const firstScan = pgDiscovery({ latest: 1000n });

    await scanApprovalGraph({
      owner: dOwner,
      assets: [],
      networkId: MAINNET,
      client: pgClient({}),
      storage: restartStorage,
      discovery: firstScan,
    });

    const secondScan = pgDiscovery({ latest: 1100n });

    await scanApprovalGraph({
      owner: dOwner,
      assets: [],
      networkId: MAINNET,
      client: pgClient({}),
      storage: restartStorage,
      discovery: secondScan,
    });

    check(
      "a first scan backfills from genesis; a later scan resumes incrementally instead of re-reading all history",
      firstScan.calls[0]?.fromBlock === 0n &&
        secondScan.calls[0]?.fromBlock === 1000n - 12n &&
        secondScan.calls[0]?.fromBlock !== 0n,
      `first ${firstScan.calls[0]?.fromBlock}, second ${secondScan.calls[0]?.fromBlock}`,
    );

    const reorgStorage = createMemoryStorage();

    const seenAt995 = (range: ScanRange) =>
      range.fromBlock <= 995n && 995n <= range.toBlock
        ? [{ token: DTOKEN, spender: DUNKNOWN }]
        : [];

    await scanApprovalGraph({
      owner: dOwner,
      assets: [],
      networkId: MAINNET,
      client: pgClient({ [pairOf(DTOKEN, DUNKNOWN)]: 5n }),
      storage: reorgStorage,
      discovery: pgDiscovery({ latest: 1000n, logs: seenAt995 }),
    });

    const afterReorg = await scanApprovalGraph({
      owner: dOwner,
      assets: [],
      networkId: MAINNET,
      client: pgClient({ [pairOf(DTOKEN, DUNKNOWN)]: 5n }),
      storage: reorgStorage,
      discovery: pgDiscovery({ latest: 1100n, logs: seenAt995 }),
    });

    check(
      "re-reading an overlapping range after a reorg does not double a permission",
      afterReorg.approvals.filter(
        (row) => row.spender.toLowerCase() === DUNKNOWN.toLowerCase(),
      ).length === 1,
      `rows ${afterReorg.approvals.length}`,
    );

    const persisted = parseDiscoveryState(
      await reorgStorage.get(
        `permissiongraph.discovery.v1.${MAINNET}.${dOwner.toLowerCase()}`,
      ),
    );

    check(
      "the persisted candidate set stays deduped across runs",
      persisted.pairs.length === 1,
      `persisted pairs ${persisted.pairs.length}`,
    );

    const flood: ApprovalLogRecord[] = [];

    const floodPairs: Record<string, bigint | "fail"> = {};

    for (let i = 0; i < 50; i += 1) {
      const spender = `0x${(i + 1).toString(16).padStart(40, "0")}` as Address;

      flood.push({ token: DTOKEN, spender });

      floodPairs[pairOf(DTOKEN, spender)] = 5n;
    }

    const flooded = await scanApprovalGraph({
      owner: dOwner,
      assets: [],
      networkId: MAINNET,
      client: pgClient(floodPairs),
      storage: createMemoryStorage(),
      discovery: pgDiscovery({ latest: 1000n, logs: () => flood }),
    });

    check(
      "a token spamming forged approvals is capped per token and flagged partial, not silently trusted whole",
      flooded.approvals.filter(
        (row) => row.token.toLowerCase() === DTOKEN.toLowerCase(),
      ).length === 20 && flooded.coverage === "partial",
      `rows ${flooded.approvals.length}, coverage ${flooded.coverage}`,
    );

    check(
      "range planning: never-scanned backfills genesis→head; a scanned wallet resumes behind the frontier by the reorg overlap",
      (() => {
        const fresh = planScanRange({
          lastScannedBlock: null,
          latestBlock: 5000n,
          reorgOverlap: 12n,
        });

        const resumed = planScanRange({
          lastScannedBlock: 4000n,
          latestBlock: 5000n,
          reorgOverlap: 12n,
        });

        const rewound = planScanRange({
          lastScannedBlock: 6000n,
          latestBlock: 5000n,
          reorgOverlap: 12n,
        });

        const impossible = planScanRange({
          lastScannedBlock: null,
          latestBlock: -1n,
          reorgOverlap: 12n,
        });

        return (
          fresh?.fromBlock === 0n &&
          fresh?.toBlock === 5000n &&
          resumed?.fromBlock === 3988n &&
          rewound?.fromBlock === 4988n &&
          impossible === null
        );
      })(),
      "planScanRange handles fresh, incremental, reorg-rewound and impossible heads",
    );

    check(
      "chunking splits a range into gap-free windows and clamps the last one",
      (() => {
        const chunks = chunkRange({ fromBlock: 0n, toBlock: 1200n }, 500n);

        return (
          chunks.length === 3 &&
          chunks[0].toBlock === 499n &&
          chunks[1].fromBlock === 500n &&
          chunks[2].fromBlock === 1000n &&
          chunks[2].toBlock === 1200n
        );
      })(),
      "chunkRange covers the whole range with no gaps or overlaps",
    );

    check(
      "candidate extraction dedupes and merging unions across sources, dropping malformed pairs",
      (() => {
        const extracted = extractCandidatePairs([
          { token: DTOKEN, spender: DUNKNOWN },
          { token: DTOKEN, spender: DUNKNOWN },
          { token: DTOKEN2, spender: DUNKNOWN },
        ]);

        const merged = mergePairs(
          [{ token: DTOKEN, spender: DUNKNOWN }],
          [
            { token: DTOKEN, spender: DUNKNOWN },
            { token: DTOKEN2, spender: DROUTER },
          ],
          [{ token: "not-an-address" as Address, spender: DUNKNOWN }],
        );

        return extracted.length === 2 && merged.length === 2;
      })(),
      "one pair per (token, spender); junk is discarded",
    );

    check(
      "coverage and frontier: a failed window makes coverage partial and stops the frontier before the gap",
      (() => {
        const outcomes = [
          { range: { fromBlock: 0n, toBlock: 99n }, ok: true },
          { range: { fromBlock: 100n, toBlock: 199n }, ok: false },
          { range: { fromBlock: 200n, toBlock: 299n }, ok: true },
        ];

        const allOk = [
          { range: { fromBlock: 0n, toBlock: 99n }, ok: true },
          { range: { fromBlock: 100n, toBlock: 199n }, ok: true },
        ];

        return (
          computeCoverage(outcomes) === "partial" &&
          computeCoverage(allOk) === "complete" &&
          computeCoverage(allOk, false) === "partial" &&
          scannedFrontier(outcomes, null) === 99n &&
          scannedFrontier(allOk, null) === 199n
        );
      })(),
      "partial history is never reported as complete; the frontier never jumps a gap",
    );

    check(
      "discovery state survives a round trip and a corrupt blob resets to a full backfill",
      (() => {
        const round = parseDiscoveryState(
          serializeDiscoveryState({
            lastScannedBlock: 12345n,
            pairs: [{ token: DTOKEN, spender: DUNKNOWN }],
          }),
        );

        const corrupt = parseDiscoveryState("{ not json");

        const wrongVersion = parseDiscoveryState(
          JSON.stringify({ version: 999, lastScannedBlock: "5", pairs: [] }),
        );

        return (
          round.lastScannedBlock === 12345n &&
          round.pairs.length === 1 &&
          corrupt.lastScannedBlock === null &&
          corrupt.pairs.length === 0 &&
          wrongVersion.lastScannedBlock === null
        );
      })(),
      "persisted state is either fully trusted or treated as never-scanned",
    );
  }

  // ---- Recipient Intelligence: address poisoning ----------------------------
  //
  // Familiarity and visual confusion are independent axes. The reference set is
  // proven sends only; "first-time" is claimed only under complete history; a
  // used address still warns when a different used address shares its shortened
  // form; and the shape the detector compares is the shape the user reads.
  {
    const OWN = "0x1234567890123456789012345678901234567890" as Address;

    const Y = ("0x71f2" + "0".repeat(32) + "9a4c") as Address; // real recipient

    const X = ("0x71f2" + "1".repeat(32) + "9a4c") as Address; // lookalike of Y

    const Y2 = ("0x71f2" + "2".repeat(32) + "9a4c") as Address; // another twin

    const Z = ("0x9999" + "0".repeat(32) + "1111") as Address; // unrelated

    // THE adversarial test: the lookalike arrived as inbound dust, so it is not
    // in the proven-send set. It must warn, and must never be called known.
    const dust = analyzeRecipient({
      recipient: X,
      ownAddress: OWN,
      provenRecipients: [Y],
      historyCoverage: "partial",
    });

    check(
      "an inbound-dust lookalike is flagged and never treated as a known recipient",
      dust.identity !== "previously-sent" &&
        dust.lookalike !== null &&
        dust.lookalike.matches.some((m) => m.toLowerCase() === Y.toLowerCase()),
      `identity ${dust.identity}, matches ${dust.lookalike?.matches.length ?? 0}`,
    );

    const refset = provenRecipientsFromTransfers(OWN, [
      { category: "external", from: OWN, to: Y }, // real send → Y
      { category: "external", from: X, to: OWN }, // inbound dust FROM lookalike → excluded
      { category: "erc20", from: OWN, to: Z }, // erc-20 log → intent unproven → excluded
    ]);

    check(
      "the proven-recipient set is built from outgoing native sends only, never from who paid you",
      refset.length === 1 && refset[0].toLowerCase() === Y.toLowerCase(),
      `recipients [${refset.join(", ")}]`,
    );

    const exact = analyzeRecipient({
      recipient: Y,
      ownAddress: OWN,
      provenRecipients: [Y],
      historyCoverage: "complete",
    });

    check(
      "an address we have provably sent to is previously-sent, with no false lookalike",
      exact.identity === "previously-sent" && exact.lookalike === null,
      `identity ${exact.identity}, lookalike ${exact.lookalike ? "yes" : "no"}`,
    );

    const cased = analyzeRecipient({
      recipient: ("0x71F2" + "0".repeat(32) + "9A4C") as Address,
      ownAddress: OWN,
      provenRecipients: [Y],
      historyCoverage: "complete",
    });

    check(
      "recipient identity ignores address casing",
      cased.identity === "previously-sent",
      `identity ${cased.identity}`,
    );

    const partial = analyzeRecipient({
      recipient: Z,
      ownAddress: OWN,
      provenRecipients: [Y],
      historyCoverage: "partial",
    });

    const complete = analyzeRecipient({
      recipient: Z,
      ownAddress: OWN,
      provenRecipients: [Y],
      historyCoverage: "complete",
    });

    check(
      "with partial history an unseen address is not-seen, not falsely declared first-time",
      partial.identity === "not-seen" && complete.identity === "first-time",
      `partial ${partial.identity}, complete ${complete.identity}`,
    );

    const unavailable = analyzeRecipient({
      recipient: Z,
      ownAddress: OWN,
      provenRecipients: [],
      historyCoverage: "unavailable",
    });

    check(
      "when history could not be read an unfamiliar address is unknown, never first-time",
      unavailable.identity === "unknown",
      `identity ${unavailable.identity}`,
    );

    const both = analyzeRecipient({
      recipient: Y,
      ownAddress: OWN,
      provenRecipients: [Y, Y2], // Y2 shares Y's shortened form
      historyCoverage: "complete",
    });

    check(
      "a previously-sent address still warns when a different used address shares its shortened form",
      both.identity === "previously-sent" &&
        both.lookalike !== null &&
        both.lookalike.matches.some((m) => m.toLowerCase() === Y2.toLowerCase()),
      `identity ${both.identity}, lookalike ${both.lookalike ? "yes" : "no"}`,
    );

    const multi = analyzeRecipient({
      recipient: X,
      ownAddress: OWN,
      provenRecipients: [Y, Y2],
      historyCoverage: "partial",
    });

    check(
      "all historical addresses sharing the fingerprint are returned, in order",
      multi.lookalike?.matches.length === 2 &&
        multi.lookalike.matches[0].toLowerCase() === Y.toLowerCase() &&
        multi.lookalike.matches[1].toLowerCase() === Y2.toLowerCase(),
      `matches ${multi.lookalike?.matches.length ?? 0}`,
    );

    check(
      "the address the user reads is exactly the shape the detector compares",
      shortenAddress(X) === truncateAddress(X) &&
        addressFingerprint(X) === shortenAddress(X).toLowerCase() &&
        addressFingerprint(X) === addressFingerprint(Y) &&
        X.toLowerCase() !== Y.toLowerCase(),
      `fingerprint ${addressFingerprint(X)}`,
    );

    // A degenerate short string must not collapse under overlapping head/tail
    // slices into a false fingerprint collision.
    check(
      "the fingerprint of a too-short string is the string itself, not an overlapping collision",
      truncateAddress("0xabcd") === "0xabcd" &&
        addressFingerprint("0xabcd") !== addressFingerprint(X) &&
        truncateAddress(X).includes("…"),
      `short ${truncateAddress("0xabcd")}`,
    );

    // Firewall and recipient-intelligence must agree on "known": a confirmed
    // approve/swap names a token/router contract, not a chosen recipient, so it
    // must not enter knownRecipients.
    const ROUTER = "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45" as Address;

    const nowMs = Date.now();

    const trackedForContext = [
      {
        assetType: "native",
        from: OWN,
        to: Y,
        status: "confirmed",
        createdAt: nowMs,
        valueUsd: 0,
        valueWei: "0",
        tokenDecimals: 18,
        symbol: "ETH",
      },
      {
        assetType: "swap",
        from: OWN,
        to: ROUTER,
        status: "confirmed",
        createdAt: nowMs,
        valueUsd: 0,
        valueWei: "0",
        tokenDecimals: 18,
        symbol: "ETH",
      },
    ] as unknown as Parameters<typeof buildPolicyContext>[0]["tracked"];

    const knownCtx = buildPolicyContext({
      owner: OWN,
      activity: [],
      tracked: trackedForContext,
      priceOf: () => null,
      now: nowMs,
    });

    check(
      "a swap's router is never counted as a known recipient, but a real transfer's recipient is",
      knownCtx.knownRecipients.includes(Y.toLowerCase()) &&
        !knownCtx.knownRecipients.includes(ROUTER.toLowerCase()),
      `known [${knownCtx.knownRecipients.join(", ")}]`,
    );
  }

  // ---- Security Review v1: honest aggregation of Permission Graph ------------
  //
  // No score, no global "SAFE". Coverage gates the headline; out-of-scope areas
  // (token/recipient) are boundaries, not gaps, so a complete permission scan
  // is not falsely "incomplete"; an empty wallet is neutral, not green; and
  // undeterminable exposure ranks above any finite amount.
  {
    const mkApproval = (o: Partial<TokenApproval>): TokenApproval => ({
      id: "a1",
      channel: "erc20",
      token: "0x0000000000000000000000000000000000000001" as Address,
      tokenSymbol: "USDC",
      tokenName: "USD Coin",
      tokenDecimals: 6,
      tokenLogo: null,
      spender: "0x0000000000000000000000000000000000000002" as Address,
      spenderName: "Unknown contract",
      spenderPurpose: "Unrecognised spender",
      allowance: 1n,
      unlimited: false,
      allowanceCertain: true,
      decimalsCertain: true,
      expiresAt: null,
      exposureUsd: 100,
      exposureCertain: true,
      risk: "high",
      ...o,
    });

    const mkScan = (o: Partial<ApprovalScan>): ApprovalScan => ({
      approvals: [],
      totalExposureUsd: 0,
      checkedTokens: 1,
      checkedSpenders: 2,
      expiredCount: 0,
      uncertainCount: 0,
      coverage: "complete",
      unknownSpenderCount: 0,
      unreadBudgetCount: 0,
      unreadPermit2Count: 0,
      permit2SpendersChecked: 5,
      ...o,
    });

    // THE scoping test: a complete permission scan with only benign approvals is
    // "reviewed", and the out-of-scope token/recipient boundaries do NOT drag it
    // to "incomplete".
    const clean = buildSecurityReview(
      mkScan({ approvals: [mkApproval({ risk: "low" })] }),
    );

    check(
      "an in-scope-complete review is 'reviewed' — out-of-scope areas are boundaries, not coverage gaps",
      clean.state === "reviewed" &&
        clean.coverageGaps.length === 0 &&
        clean.notIncluded.length === 3,
      `state ${clean.state}, gaps ${clean.coverageGaps.length}, notIncluded ${clean.notIncluded.length}`,
    );

    const partialClean = buildSecurityReview(
      mkScan({ approvals: [mkApproval({ risk: "low" })], coverage: "partial" }),
    );

    check(
      "partial permission history with zero findings is 'incomplete', never a clean 'reviewed'",
      partialClean.state === "incomplete",
      `state ${partialClean.state}`,
    );

    const attention = buildSecurityReview(
      mkScan({ approvals: [mkApproval({ risk: "critical", exposureUsd: 4230 })] }),
    );

    check(
      "a high/critical approval on a complete scan needs attention",
      attention.state === "attention" && attention.openItems.length === 1,
      `state ${attention.state}, items ${attention.openItems.length}`,
    );

    const findingAndGap = buildSecurityReview(
      mkScan({ approvals: [mkApproval({ risk: "critical" })], coverage: "partial" }),
    );

    check(
      "findings still surface, but an incomplete scan leads with 'incomplete'",
      findingAndGap.state === "incomplete" && findingAndGap.openItems.length === 1,
      `state ${findingAndGap.state}, items ${findingAndGap.openItems.length}`,
    );

    const emptyWallet = buildSecurityReview(
      mkScan({ approvals: [], checkedTokens: 0 }),
    );

    check(
      "an empty wallet is 'nothing to review yet', never a green all-clear",
      emptyWallet.state === "neutral",
      `state ${emptyWallet.state}`,
    );

    const ranked = buildSecurityReview(
      mkScan({
        approvals: [
          mkApproval({ id: "finite", risk: "high", exposureUsd: 5000 }),
          mkApproval({ id: "unknown", risk: "high", exposureUsd: null }),
        ],
      }),
    );

    check(
      "an approval whose exposure could not be determined ranks above any finite amount",
      ranked.openItems[0]?.subjectRef === "unknown" &&
        ranked.openItems[1]?.subjectRef === "finite",
      `order ${ranked.openItems.map((i) => i.subjectRef).join(">")}`,
    );

    const unreadable = buildSecurityReview(
      mkScan({ approvals: [mkApproval({ risk: "critical", allowanceCertain: false })] }),
    );

    check(
      "an unreadable permission is a coverage gap, not a finding, and never silently dropped",
      unreadable.state === "incomplete" &&
        unreadable.openItems.length === 0 &&
        unreadable.coverageGaps.length === 1,
      `state ${unreadable.state}, items ${unreadable.openItems.length}, gaps ${unreadable.coverageGaps.length}`,
    );

    const counted = buildSecurityReview(
      mkScan({
        approvals: [
          mkApproval({ id: "f1", risk: "critical" }),
          mkApproval({ id: "u1", risk: "critical", allowanceCertain: false }),
          mkApproval({ id: "u2", risk: "high", allowanceCertain: false }),
        ],
      }),
    );

    check(
      "findings and unread permissions are counted side by side, never summed into one total",
      counted.openItems.length === 1 && counted.unverifiedPermissionCount === 2,
      `${counted.openItems.length} active, ${counted.unverifiedPermissionCount} unverified`,
    );

    // "Nothing to review yet" asserts that we looked and found nothing. When
    // the looking failed, the honest state is the unfinished check, not the
    // absence.
    const emptyAndPartial = buildSecurityReview(
      mkScan({ approvals: [], checkedTokens: 0, coverage: "partial" }),
    );

    check(
      "an empty wallet whose history could not be read is incomplete, not an established absence",
      emptyAndPartial.state === "incomplete",
      `state ${emptyAndPartial.state}`,
    );

    // The exposure total silently omits every row it cannot price. Count those
    // rows so the headline figure is never mistaken for the whole picture.
    const unvalued = buildSecurityReview(
      mkScan({
        approvals: [
          mkApproval({ id: "priced", exposureUsd: 100 }),
          mkApproval({ id: "unpriced", exposureUsd: null }),
          mkApproval({ id: "unread", allowanceCertain: false }),
        ],
      }),
    );

    check(
      "permissions that carry no dollar figure are counted apart from the exposure total",
      unvalued.unvaluedPermissionCount === 2,
      `${unvalued.unvaluedPermissionCount} unvalued of ${unvalued.reviewedPermissionCount + unvalued.unverifiedPermissionCount}`,
    );

    // A Permit2 row whose ERC-20 budget could not be read still produces a
    // number. That number is not a verified fact, so the review must not call
    // itself finished on the strength of it.
    const unconfirmed = buildSecurityReview(
      mkScan({
        unreadBudgetCount: 1,
        approvals: [
          mkApproval({
            id: "permit2",
            channel: "permit2",
            risk: "medium",
            exposureUsd: 1000,
            exposureCertain: false,
          }),
        ],
      }),
    );

    check(
      "a dollar figure resting on a failed read opens a coverage gap instead of a clean review",
      unconfirmed.state === "incomplete" &&
        unconfirmed.coverageGaps.some((gap) =>
          gap.reason.includes("Permit2 budget"),
        ),
      `state ${unconfirmed.state}, gaps ${unconfirmed.coverageGaps.length}`,
    );

    // The same failed read on a token we cannot price leaves no figure at all —
    // it must still be reported, or the silence reads as a finished review.
    const unconfirmedUnpriced = buildSecurityReview(
      mkScan({
        unreadBudgetCount: 1,
        approvals: [
          mkApproval({
            id: "permit2-unpriced",
            channel: "permit2",
            risk: "medium",
            exposureUsd: null,
            exposureCertain: false,
          }),
        ],
      }),
    );

    check(
      "a failed budget read on an unpriced token is reported too, not hidden behind a missing figure",
      unconfirmedUnpriced.state === "incomplete",
      `state ${unconfirmedUnpriced.state}, gaps ${unconfirmedUnpriced.coverageGaps.length}`,
    );

    // An unpriced token on its own is not a failed read: it must not make the
    // review permanently incomplete.
    const merelyUnpriced = buildSecurityReview(
      mkScan({
        approvals: [
          mkApproval({ risk: "low", exposureUsd: null, exposureCertain: false }),
        ],
      }),
    );

    check(
      "a token we simply cannot price does not make the review incomplete forever",
      merelyUnpriced.state === "reviewed",
      `state ${merelyUnpriced.state}`,
    );

    // A live budget whose per-spender lookups all failed leaves no rows at all.
    // Silence there must not be read as "no Permit2 permissions".
    const unreadLookups = buildSecurityReview(
      mkScan({
        unreadPermit2Count: 3,
        approvals: [mkApproval({ risk: "low" })],
      }),
    );

    check(
      "failed Permit2 lookups are reported instead of passing for an absence of permissions",
      unreadLookups.state === "incomplete" &&
        unreadLookups.coverageGaps.some((gap) =>
          gap.reason.includes("could not be read"),
        ),
      `state ${unreadLookups.state}, gaps ${unreadLookups.coverageGaps.length}`,
    );

    // A channel that was never queried at all is the same class of silence as a
    // failed read: it must not pass for "nothing found".
    const permit2Unasked = buildSecurityReview(
      mkScan({
        permit2SpendersChecked: 0,
        approvals: [mkApproval({ risk: "low" })],
      }),
    );

    check(
      "a Permit2 channel that was never queried is stated as a standing limit, not a retryable gap",
      permit2Unasked.coverageGaps.length === 0 &&
        permit2Unasked.notIncluded.some(
          (boundary) =>
            boundary.area.includes("Permit2") &&
            boundary.detail.includes("not checked on this network"),
        ),
      `state ${permit2Unasked.state}, gaps ${permit2Unasked.coverageGaps.length}`,
    );

    // The limit is stated even on a healthy scan: Permit2 spenders are probed
    // from a list, never discovered, so a clean result cannot imply the whole
    // channel was searched.
    check(
      "the review always states that Permit2 spenders are checked from a list, not discovered",
      clean.notIncluded.some((boundary) =>
        boundary.area.includes("Permit2"),
      ),
      clean.notIncluded.map((b) => b.area).join(", "),
    );
  }

  // The visible approvals list must obey the same attention rule as the review:
  // an exposure that could not be determined outranks any amount that could.
  {
    const pricedToken = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as Address;

    const unpricedToken = "0xB0b86991c6218b36c1d19d4a2E9eb0Ce3606Eb49" as Address;

    const asset = (
      contractAddress: Address,
      symbol: string,
      priceUsd: number | null,
    ) => ({
      type: "erc20" as const,
      symbol,
      name: symbol,
      balance: "1000",
      decimals: 6,
      decimalsKnown: true,
      priceUsd,
      valueUsd: priceUsd === null ? null : 1000 * priceUsd,
      logo: null,
      contractAddress,
    });

    const sorted = await getApprovals(
      generated.address,
      [asset(pricedToken, "USDC", 1), asset(unpricedToken, "MYST", null)],
      "eth-mainnet",
      {
        async multicall({
          contracts,
        }: {
          contracts: { address: string; args: readonly unknown[] }[];
        }) {
          return contracts.map((call) => {
            if (
              call.address.toLowerCase() ===
              "0x000000000022D473030F116dDEE9F6B43aC78BA3".toLowerCase()
            ) {
              return { status: "success" as const, result: [0n, 0, 0] as const };
            }

            // A modest, knowable allowance on both tokens: same severity, so
            // only the unknown-vs-known exposure rule can order them.
            return { status: "success" as const, result: 100_000_000n };
          });
        },
      } as unknown as Parameters<typeof getApprovals>[3],
      { coverage: "complete" },
    );

    const sameRisk =
      new Set(sorted.approvals.map((row) => row.risk)).size === 1;

    const lastUnknown = sorted.approvals.reduce(
      (last, row, index) => (row.exposureUsd === null ? index : last),
      -1,
    );

    const firstKnown = sorted.approvals.findIndex(
      (row) => row.exposureUsd !== null,
    );

    check(
      "in the permission list an undeterminable exposure is never sorted below a known amount",
      sameRisk &&
        lastUnknown >= 0 &&
        firstKnown >= 0 &&
        lastUnknown < firstKnown,
      `unknown rows end at ${lastUnknown}, known rows start at ${firstKnown}, same risk: ${sameRisk}`,
    );

    // A discovered token the wallet does not hold has no metadata, so its
    // decimals are a placeholder. The row must admit that instead of printing
    // an amount that would be wrong by orders of magnitude.
    const strangeToken = "0xC0b86991c6218b36c1d19d4A2e9Eb0cE3606Eb50" as Address;

    const discoveredMeta = await getApprovals(
      generated.address,
      [asset(pricedToken, "USDC", 1)],
      "eth-mainnet",
      {
        async multicall({
          contracts,
        }: {
          contracts: { address: string; args: readonly unknown[] }[];
        }) {
          return contracts.map((call) => {
            if (
              call.address.toLowerCase() ===
              "0x000000000022D473030F116dDEE9F6B43aC78BA3".toLowerCase()
            ) {
              return { status: "success" as const, result: [0n, 0, 0] as const };
            }

            return { status: "success" as const, result: 1_000_000n };
          });
        },
      } as unknown as Parameters<typeof getApprovals>[3],
      {
        discovered: [
          { token: strangeToken, spender: ROUTER as Address, tokenMeta: null },
        ],
      },
    );

    const strangeRow = discoveredMeta.approvals.find(
      (row) => row.token.toLowerCase() === strangeToken.toLowerCase(),
    );

    const heldRow = discoveredMeta.approvals.find(
      (row) => row.token.toLowerCase() === pricedToken.toLowerCase(),
    );

    check(
      "a token with no metadata is never given invented decimals to print an amount from",
      strangeRow?.decimalsCertain === false && heldRow?.decimalsCertain === true,
      `unknown token: ${strangeRow?.decimalsCertain}, held token: ${heldRow?.decimalsCertain}`,
    );

    // The portfolio itself falls back to 18 when a token does not report its
    // decimals. That uncertainty must survive into the permission row rather
    // than being upgraded to a fact just because the wallet holds the token.
    const heldButUndescribed = await getApprovals(
      generated.address,
      [{ ...asset(pricedToken, "USDC", 1), decimalsKnown: false }],
      "eth-mainnet",
      {
        async multicall({
          contracts,
        }: {
          contracts: { address: string; args: readonly unknown[] }[];
        }) {
          return contracts.map((call) =>
            call.address.toLowerCase() ===
            "0x000000000022D473030F116dDEE9F6B43aC78BA3".toLowerCase()
              ? { status: "success" as const, result: [0n, 0, 0] as const }
              : { status: "success" as const, result: 1_000_000n },
          );
        },
      } as unknown as Parameters<typeof getApprovals>[3],
    );

    check(
      "a held token whose decimals the portfolio had to guess does not print its allowance as fact",
      heldButUndescribed.approvals.length > 0 &&
        heldButUndescribed.approvals.every((row) => !row.decimalsCertain),
      `${heldButUndescribed.approvals.length} rows, all uncertain: ${heldButUndescribed.approvals.every((row) => !row.decimalsCertain)}`,
    );
  }

  // ---- Watchlist v1: identity, persistence, limits, honesty ----------------
  {
    const A = "0xAAaAaAAAaaAAAAaAaaaAaAaAaAaaAaaAAaaaAAa1" as Address;

    const B = "0xBbBBbbBBbBBBbbBbbbbBbBbBBbBbbbBBBBbBbBB2" as Address;

    const idA = { chainId: 1, address: A };

    const idB = { chainId: 1, address: B };

    check(
      "identity is chain plus address, compared case-insensitively",
      sameWatchedAsset(idA, { chainId: 1, address: A.toLowerCase() as Address }) &&
        !sameWatchedAsset(idA, idB) &&
        // The same address on another chain is a different token.
        !sameWatchedAsset(idA, { chainId: 137, address: A }) &&
        watchKey(idA) === `1:${A.toLowerCase()}`,
      watchKey(idA),
    );

    const oneNibbleOff = (A.slice(0, -1) + "2") as Address;

    check(
      "a route carries the whole identity: the same address on another chain is a different route",
      (() => {
        const here = assetRouteParams({ chainId: 1, address: A });

        const elsewhere = assetRouteParams({ chainId: 137, address: A });

        const keyOf = (params: { id: string; chainId: string }) =>
          assetRouteKey({ chainId: Number(params.chainId), id: params.id });

        return (
          here.id === A &&
          here.chainId === "1" &&
          keyOf(here) !== keyOf(elsewhere) &&
          // Casing is display, not identity, on the boundary too.
          keyOf(here) ===
            keyOf(assetRouteParams({ chainId: 1, address: A.toLowerCase() })) &&
          // A missing or hostile chainId falls back instead of becoming NaN or
          // a silently wrong identity. Router params can also arrive as arrays.
          parseRouteChainId(undefined, 11155111) === 11155111 &&
          parseRouteChainId("not-a-number", 11155111) === 11155111 &&
          parseRouteChainId("-5", 11155111) === 11155111 &&
          parseRouteChainId("0", 11155111) === 11155111 &&
          parseRouteChainId("1.5", 11155111) === 11155111 &&
          parseRouteChainId("", 11155111) === 11155111 &&
          parseRouteChainId(["137"], 11155111) === 137 &&
          parseRouteChainId([], 11155111) === 11155111 &&
          parseRouteChainId("137", 11155111) === 137
        );
      })(),
      "route identity is (chainId, address)",
    );

    check(
      "an entry saved for another network is never enriched with this network's data",
      canEnrichOnNetwork({ chainId: 11155111, address: A }, 11155111) &&
        !canEnrichOnNetwork({ chainId: 1, address: A }, 11155111),
      "one network's verdict never lands on another network's token",
    );

    check(
      "an address that differs by a single nibble is a different token",
      !sameWatchedAsset(idA, { chainId: 1, address: oneNibbleOff }),
      `${A} vs ${oneNibbleOff}`,
    );

    const added = addWatched([], idA, 1000);

    const addedTwice = added.ok ? addWatched(added.items, idA, 2000) : null;

    check(
      "adding the same token twice keeps exactly one entry and reports success",
      added.ok &&
        added.items.length === 1 &&
        addedTwice?.ok === true &&
        addedTwice.items.length === 1 &&
        addedTwice.alreadyWatched === true,
      `after two adds: ${addedTwice?.ok ? addedTwice.items.length : "error"}`,
    );

    check(
      "removing a token that was never watched changes nothing",
      removeWatched(added.ok ? added.items : [], idB).length === 1 &&
        removeWatched(added.ok ? added.items : [], idA).length === 0,
      "remove is idempotent",
    );

    // Two contracts sharing a symbol is exactly how impersonation works, so they
    // must be independently watchable.
    const twinSymbols = addWatched(
      added.ok ? added.items : [],
      idB,
      1500,
    );

    check(
      "two different contracts with the same symbol are watched independently",
      twinSymbols.ok && twinSymbols.items.length === 2,
      `${twinSymbols.ok ? twinSymbols.items.length : 0} entries`,
    );

    const crossChain = addWatched(
      added.ok ? added.items : [],
      { chainId: 137, address: A },
      1600,
    );

    check(
      "the same address on another chain is watched independently",
      crossChain.ok && crossChain.items.length === 2,
      `${crossChain.ok ? crossChain.items.length : 0} entries`,
    );

    let full: WatchedToken[] = [];

    for (let i = 0; i < MAX_WATCHLIST_ITEMS; i += 1) {
      const address = `0x${(i + 1)
        .toString(16)
        .padStart(40, "0")}` as Address;

      const result = addWatched(full, { chainId: 1, address }, 1000 + i);

      if (result.ok) {
        full = result.items;
      }
    }

    const overflow = addWatched(full, idA, 9999);

    check(
      "the cap refuses the addition instead of silently evicting the oldest",
      full.length === MAX_WATCHLIST_ITEMS &&
        !overflow.ok &&
        overflow.reason === "limit-reached" &&
        isWatched(full, {
          chainId: 1,
          address: `0x${(1).toString(16).padStart(40, "0")}` as Address,
        }),
      `at cap ${full.length}, oldest still present`,
    );

    const roundTrip = parseWatchlist(
      serializeWatchlist([
        { chainId: 1, address: A, addedAt: 10 },
        { chainId: 137, address: B, addedAt: 20 },
      ]),
    );

    check(
      "a saved watchlist survives a restart intact",
      roundTrip.status === "ready" &&
        roundTrip.items.length === 2 &&
        roundTrip.repaired === false,
      `${roundTrip.status === "ready" ? roundTrip.items.length : "unreadable"} items`,
    );

    const corrupt = parseWatchlist("{ not json");

    const futureVersion = parseWatchlist(
      JSON.stringify({ version: 99, items: [] }),
    );

    check(
      "corrupt or future storage is reported as unreadable, never as an empty watchlist",
      corrupt.status === "unreadable" && futureVersion.status === "unreadable",
      `corrupt: ${corrupt.status}, future: ${futureVersion.status}`,
    );

    const messy = parseWatchlist(
      JSON.stringify({
        version: 1,
        items: [
          { chainId: 1, address: A, addedAt: 1 },
          { chainId: 1, address: A.toLowerCase(), addedAt: 2 },
          { chainId: 1, address: "not-an-address", addedAt: 3 },
          { chainId: 0, address: B, addedAt: 4 },
          null,
        ],
      }),
    );

    check(
      "duplicates and malformed entries are repaired deterministically and flagged",
      messy.status === "ready" &&
        messy.items.length === 1 &&
        messy.repaired === true,
      `${messy.status === "ready" ? messy.items.length : "unreadable"} kept, repaired ${
        messy.status === "ready" ? messy.repaired : "n/a"
      }`,
    );

    check(
      "an empty store is a readable empty watchlist, not an error",
      parseWatchlist(null).status === "ready",
      "nothing saved yet is not a failure",
    );

    // §30, the remaining corrupt shapes, pinned so the contract cannot drift.
    const notAnArray = parseWatchlist(
      JSON.stringify({ version: 1, items: "nope" }),
    );

    const overCap = parseWatchlist(
      JSON.stringify({
        version: 1,
        items: Array.from({ length: 60 }, (_, index) => ({
          chainId: 1,
          address: `0x${(index + 1).toString(16).padStart(40, "0")}`,
          addedAt: index,
        })),
      }),
    );

    const brokenTimestamp = parseWatchlist(
      JSON.stringify({
        version: 1,
        items: [{ chainId: 1, address: A, addedAt: "yesterday" }],
      }),
    );

    check(
      "the remaining corrupt shapes each have a fixed, reported outcome",
      notAnArray.status === "unreadable" &&
        overCap.status === "ready" &&
        overCap.items.length === MAX_WATCHLIST_ITEMS &&
        overCap.repaired === true &&
        // The newest survive the trim, deterministically.
        overCap.items[0].addedAt === 59 &&
        brokenTimestamp.status === "ready" &&
        brokenTimestamp.repaired === true,
      `not-array: ${notAnArray.status}, over-cap kept ${
        overCap.status === "ready" ? overCap.items.length : "n/a"
      }, bad timestamp repaired: ${
        brokenTimestamp.status === "ready" ? brokenTimestamp.repaired : "n/a"
      }`,
    );

    check(
      "the storage key does not depend on the selected wallet account",
      WATCHLIST_STORAGE_KEY === "watchlist.v1" &&
        !WATCHLIST_STORAGE_KEY.includes("0x"),
      WATCHLIST_STORAGE_KEY,
    );

    check(
      "the default order is most recently added first, deterministically",
      (() => {
        const sorted = sortWatchlist([
          { chainId: 1, address: A, addedAt: 10 },
          { chainId: 1, address: B, addedAt: 30 },
          { chainId: 137, address: A, addedAt: 20 },
        ]);

        return (
          sorted[0].addedAt === 30 &&
          sorted[1].addedAt === 20 &&
          sorted[2].addedAt === 10
        );
      })(),
      "newest first",
    );

    check(
      "search finds a token by address even when its metadata never arrived",
      (() => {
        const items: WatchedToken[] = [
          { chainId: 1, address: A, addedAt: 1 },
          { chainId: 1, address: B, addedAt: 2 },
        ];

        const describe = (id: { address: Address }) =>
          id.address.toLowerCase() === B.toLowerCase()
            ? { symbol: "PEPE", name: "Pepe" }
            : {};

        const byAddress = searchWatchlist(items, A.slice(2, 10), describe);

        const bySymbol = searchWatchlist(items, "pep", describe);

        const noQuery = searchWatchlist(items, "   ", describe);

        return (
          byAddress.length === 1 &&
          byAddress[0].address.toLowerCase() === A.toLowerCase() &&
          bySymbol.length === 1 &&
          noQuery.length === 2
        );
      })(),
      "address search works without metadata",
    );

    // Bounded refresh: fifty watched tokens must not become fifty fan-outs.
    check(
      "the refresh queue never runs more than its limit at once and survives failures",
      await (async () => {
        const order: number[] = [];

        let inFlight = 0;

        let peak = 0;

        const settled: unknown[] = [];

        await runBounded({
          items: Array.from({ length: 20 }, (_, index) => index),

          limit: 4,

          worker: async (item) => {
            inFlight += 1;

            peak = Math.max(peak, inFlight);

            await new Promise((resolve) => setTimeout(resolve, 1));

            order.push(item);

            inFlight -= 1;

            if (item % 5 === 0) {
              throw new Error("provider down");
            }
          },

          onSettled: (_item, _index, error) => {
            settled.push(error);
          },
        });

        return (
          peak <= 4 &&
          order.length === 20 &&
          settled.length === 20 &&
          settled.filter((error) => error !== null).length === 4
        );
      })(),
      "bounded concurrency, queue continues past failures",
    );

    check(
      "a nonsensical concurrency limit still refreshes every item instead of silently doing nothing",
      await (async () => {
        const done: number[] = [];

        await runBounded({
          items: [1, 2, 3],

          limit: Number.NaN,

          worker: async (item) => {
            done.push(item);
          },
        });

        return done.length === 3;
      })(),
      "a broken limit must not resolve as a successful no-op",
    );

    // ---- store: serialized mutations, no lost update ----------------------
    const slowStorage = (initial: string | null = null) => {
      let value = initial;

      const delay = () => new Promise((resolve) => setTimeout(resolve, 2));

      return {
        store: {
          async get() {
            await delay();

            return value;
          },

          async set(_key: string, next: string) {
            await delay();

            value = next;
          },

          async remove() {
            value = null;
          },
        },

        read: () => value,
      };
    };

    const racy = slowStorage();

    const store = createWatchlistStore({ storage: racy.store });

    await Promise.all([store.add(idA, 1), store.add(idB, 2)]);

    const afterRace = await store.load();

    check(
      "two tokens watched at the same moment both survive — no lost update",
      afterRace.status === "ready" &&
        afterRace.items.length === 2 &&
        isWatched(afterRace.items, idA) &&
        isWatched(afterRace.items, idB),
      `${afterRace.status === "ready" ? afterRace.items.length : "unreadable"} items after concurrent adds`,
    );

    await Promise.all([store.remove(idA), store.add({ chainId: 1, address: oneNibbleOff }, 3)]);

    const afterMixed = await store.load();

    check(
      "a remove racing an add loses neither operation",
      afterMixed.status === "ready" &&
        !isWatched(afterMixed.items, idA) &&
        isWatched(afterMixed.items, idB) &&
        isWatched(afterMixed.items, { chainId: 1, address: oneNibbleOff }),
      `${afterMixed.status === "ready" ? afterMixed.items.map((i) => i.address).join(",") : "unreadable"}`,
    );

    const corruptStore = createWatchlistStore({
      storage: slowStorage("{ broken").store,
    });

    const refusedAdd = await corruptStore.add(idA, 1);

    check(
      "an unreadable store is never overwritten by a new addition",
      !refusedAdd.ok && refusedAdd.reason === "unreadable",
      refusedAdd.ok ? "overwrote it" : refusedAdd.reason,
    );

    check(
      "an unreadable store answers 'we do not know', not a confident 'not watching'",
      (await corruptStore.isWatched(idA)) === "unreadable" &&
        (await store.isWatched(idB)) === "watching" &&
        (await store.isWatched({ chainId: 999, address: A })) ===
          "not-watching",
      "three answers, not two",
    );

    const invalidAdd = await store.add(
      { chainId: 0, address: A },
      1,
    );

    const invalidAddress = await store.add(
      { chainId: 1, address: "0xnope" as Address },
      1,
    );

    check(
      "the writer refuses exactly what the reader would discard, so nothing vanishes on restart",
      !invalidAdd.ok &&
        invalidAdd.reason === "invalid-asset" &&
        !invalidAddress.ok &&
        invalidAddress.reason === "invalid-asset",
      `${invalidAdd.ok ? "accepted" : invalidAdd.reason} / ${invalidAddress.ok ? "accepted" : invalidAddress.reason}`,
    );

    const failingWrite = createWatchlistStore({
      storage: {
        async get() {
          return null;
        },

        async set() {
          throw new Error("disk full");
        },

        async remove() {},
      },
    });

    const writeFailed = await failingWrite.add(idA, 1);

    check(
      "a failed write is reported instead of pretending the token was saved",
      !writeFailed.ok && writeFailed.reason === "write-failed",
      writeFailed.ok ? "claimed success" : writeFailed.reason,
    );

    // ---- observations: unknown is never low, stale is never current -------
    const intel = (over: Record<string, unknown>) =>
      ({
        token: { chainId: 1, address: A },
        summary: {
          kind: "no-major-issues",
          title: "No major issues detected",
          detectedRiskCount: 0,
        },
        liquidity: { totalLiquidityUsd: { value: 4_200_000 } },
        availability: { overall: "available" },
        freshness: {
          trade: "fresh",
          contract: "fresh",
          holders: "fresh",
          liquidity: "fresh",
        },
        observedAt: 1000,
        ...over,
      }) as unknown as Parameters<typeof buildWatchRowObservation>[0]["intelligence"];

    const fresh = buildWatchRowObservation({
      intelligence: intel({}),
      refreshing: false,
    });

    const unavailable = buildWatchRowObservation({
      intelligence: intel({
        availability: { overall: "unavailable" },
        summary: {
          kind: "incomplete",
          title: "Incomplete data",
          detectedRiskCount: 0,
        },
      }),
      refreshing: false,
    });

    const unsupported = buildWatchRowObservation({
      intelligence: intel({ availability: { overall: "unsupported" } }),
      refreshing: false,
    });

    const partial = buildWatchRowObservation({
      intelligence: intel({ availability: { overall: "partial" } }),
      refreshing: false,
    });

    check(
      "a provider failure reads as unavailable or partial, never as a clean low-risk result",
      fresh.status === "current" &&
        unavailable.status === "unavailable" &&
        unsupported.status === "unsupported" &&
        partial.status === "partial" &&
        unavailable.riskKind !== "no-major-issues",
      `${fresh.status} / ${unavailable.status} / ${unsupported.status} / ${partial.status}`,
    );

    const staleRow = buildWatchRowObservation({
      intelligence: intel({
        freshness: {
          trade: "stale",
          contract: "fresh",
          holders: "fresh",
          liquidity: "fresh",
        },
      }),
      refreshing: false,
    });

    const refreshingRow = buildWatchRowObservation({
      intelligence: intel({}),
      refreshing: true,
    });

    const firstEverLoad = buildWatchRowObservation({
      intelligence: null,
      refreshing: true,
    });

    const unknownFreshness = buildWatchRowObservation({
      intelligence: intel({
        freshness: {
          trade: "unknown",
          contract: "unknown",
          holders: "unknown",
          liquidity: "unknown",
        },
      }),
      refreshing: false,
    });

    check(
      "an observation whose age is unknown is not presented as current",
      unknownFreshness.status !== "current",
      `status ${unknownFreshness.status}`,
    );

    check(
      "stale data is never shown as current, and a refresh over existing data is distinct from a first load",
      staleRow.status === "stale" &&
        refreshingRow.status === "refreshing" &&
        firstEverLoad.status === "checking" &&
        buildWatchRowObservation({ intelligence: null, refreshing: false })
          .status === "idle",
      `${staleRow.status} / ${refreshingRow.status} / ${firstEverLoad.status}`,
    );

    const noLiquidity = buildWatchRowObservation({
      intelligence: intel({
        liquidity: { totalLiquidityUsd: { value: "unknown" } },
      }),
      refreshing: false,
    });

    check(
      "unknown liquidity is reported as unknown, never as zero dollars",
      noLiquidity.liquidityUsd.known === false &&
        fresh.liquidityUsd.known === true &&
        fresh.liquidityUsd.value === 4_200_000,
      `unknown: ${noLiquidity.liquidityUsd.known}, known: ${fresh.liquidityUsd.known}`,
    );

    check(
      "the risk wording comes verbatim from the shared summary, not from a watchlist-only score",
      fresh.riskTitle === "No major issues detected" &&
        fresh.riskKind === "no-major-issues",
      `${fresh.riskKind}: ${fresh.riskTitle}`,
    );

    const noPrice = buildWatchRowObservation({
      intelligence: intel({}),
      refreshing: false,
    });

    const withPrice = buildWatchRowObservation({
      intelligence: intel({}),
      refreshing: false,
      priceUsd: 0.00124,
    });

    check(
      "a token with no price is reported as unpriced, never as worth zero dollars",
      noPrice.priceUsd.known === false &&
        withPrice.priceUsd.known === true &&
        withPrice.priceUsd.value === 0.00124,
      `no price: ${noPrice.priceUsd.known}, priced: ${withPrice.priceUsd.known}`,
    );

    // Enrichment is display data. Losing it must never evict the token: the
    // membership list and the observations are separate facts.
    const survivingStore = createWatchlistStore({
      storage: slowStorage(serializeWatchlist([{ ...idA, addedAt: 1 }])).store,
    });

    const before = await survivingStore.load();

    await runBounded({
      items: before.status === "ready" ? before.items : [],

      worker: async () => {
        throw new Error("metadata and providers are down");
      },
    });

    const after = await survivingStore.load();

    check(
      "a token whose metadata and risk lookups both fail stays on the watchlist",
      after.status === "ready" &&
        after.items.length === 1 &&
        isWatched(after.items, idA),
      `${after.status === "ready" ? after.items.length : "unreadable"} items after a total enrichment failure`,
    );
  }

  console.log(
    failed === 0
      ? "\nCore runs in Node without React Native"
      : `\nFAILED checks: ${failed}`,
  );

  if (failed > 0) {
    process.exit(1);
  }
}
