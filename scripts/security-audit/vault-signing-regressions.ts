import type { KeyValueStorage } from "@/core/ports/keyValueStorage";
import type { RandomSource } from "@/core/ports/randomSource";
import type { SecretStore } from "@/core/ports/secretStore";
import type { WalletSigner } from "@/core/ports/walletSigner";
import {
  MAX_PIN_ATTEMPTS,
  SECURITY_STORAGE_KEYS,
} from "@/core/security/security.constants";
import { verifyPin } from "@/core/security/pin";
import { lockSession, unlockSession } from "@/core/security/sessionLock";
import { grantTransactionAuthorization } from "@/core/security/transactionAuthorization";
import { signNativeTransfer } from "@/core/signing/signNativeTransfer";
import {
  TransactionValidationError,
  type PreparedNativeTransfer,
} from "@/core/transactions/nativeTransfer";
import { createWalletEngine } from "@/core/wallet/walletEngine";
import { WALLET_STORAGE_KEYS } from "@/core/wallet/wallet.constants";

type Check = {
  name: string;
  secure: boolean;
  observed: string;
};

function memoryStorage(seed: Record<string, string> = {}) {
  const values = new Map(Object.entries(seed));

  const storage: KeyValueStorage = {
    async get(key) {
      return values.get(key) ?? null;
    },
    async set(key, value) {
      values.set(key, value);
    },
    async remove(key) {
      values.delete(key);
    },
  };

  return { storage, values };
}

const random: RandomSource = {
  async getBytes(length) {
    return new Uint8Array(length);
  },
};

const mismatchHash = async () => "audit-mismatch";

function legacyPinSeed(extra: Record<string, string> = {}) {
  return {
    [SECURITY_STORAGE_KEYS.legacyPinSalt]: "audit-salt",
    [SECURITY_STORAGE_KEYS.legacyPinHash]: "audit-expected",
    ...extra,
  };
}

async function malformedAttemptCounterFailsClosed(): Promise<Check> {
  const { storage, values } = memoryStorage(
    legacyPinSeed({
      [SECURITY_STORAGE_KEYS.failedAttempts]: "NaN",
    }),
  );

  const result = await verifyPin("000000", {
    storage,
    random,
    hash: mismatchHash,
  });

  const storedAttempts = Number(
    values.get(SECURITY_STORAGE_KEYS.failedAttempts),
  );
  const blockedUntil = Number(
    values.get(SECURITY_STORAGE_KEYS.blockedUntil),
  );
  const secure =
    !result.ok &&
    result.reason === "locked" &&
    storedAttempts === MAX_PIN_ATTEMPTS &&
    Number.isFinite(blockedUntil);

  return {
    name: "malformed PIN attempt state fails closed",
    secure,
    observed: result.ok
      ? "verification unexpectedly succeeded"
      : `reason=${result.reason}; storedAttempts=${String(storedAttempts)}`,
  };
}

async function concurrentWrongPinsConsumeAttempts(): Promise<Check> {
  const values = new Map(Object.entries(legacyPinSeed()));
  let attemptReads = 0;

  const storage: KeyValueStorage = {
    async get(key) {
      if (key !== SECURITY_STORAGE_KEYS.failedAttempts) {
        return values.get(key) ?? null;
      }

      const snapshot = values.get(key) ?? null;
      attemptReads += 1;

      if (attemptReads === 1) {
        // Give every unsynchronized caller a deterministic chance to capture
        // the same pre-write snapshot. A correctly serialized verifier lets
        // this timer finish, writes attempt 1, then admits caller 2.
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      return snapshot;
    },
    async set(key, value) {
      values.set(key, value);
    },
    async remove(key) {
      values.delete(key);
    },
  };

  const results = await Promise.all(
    Array.from({ length: MAX_PIN_ATTEMPTS }, () =>
      verifyPin("000000", {
        storage,
        random,
        hash: mismatchHash,
      }),
    ),
  );

  const blocked = results.some(
    (result) => !result.ok && result.reason === "locked",
  );
  const storedAttempts = Number(
    values.get(SECURITY_STORAGE_KEYS.failedAttempts),
  );
  const blockedUntil = values.get(SECURITY_STORAGE_KEYS.blockedUntil) ?? null;
  const secure =
    blocked ||
    blockedUntil !== null ||
    (Number.isInteger(storedAttempts) && storedAttempts >= MAX_PIN_ATTEMPTS);

  return {
    name: "concurrent wrong PINs cannot collapse into one attempt",
    secure,
    observed: `calls=${results.length}; storedAttempts=${String(
      storedAttempts,
    )}; blocked=${String(blockedUntil !== null)}`,
  };
}

async function wallClockAdvanceDoesNotBypassLockout(): Promise<Check> {
  const initialNow = 1_000_000;
  const { storage } = memoryStorage(
    legacyPinSeed({
      [SECURITY_STORAGE_KEYS.failedAttempts]: String(MAX_PIN_ATTEMPTS - 1),
    }),
  );
  const originalNow = Date.now;

  try {
    Date.now = () => initialNow;
    const beforeAdvance = await verifyPin("000000", {
      storage,
      random,
      hash: mismatchHash,
    });

    // Advance the wall clock past the newly persisted deadline without any
    // elapsed wait, then submit another wrong PIN.
    Date.now = () => initialNow + 60_001;
    const afterAdvance = await verifyPin("000000", {
      storage,
      random,
      hash: mismatchHash,
    });

    const initiallyLocked =
      !beforeAdvance.ok && beforeAdvance.reason === "locked";
    const stillLocked = !afterAdvance.ok && afterAdvance.reason === "locked";

    return {
      name: "wall-clock advance cannot expire a PIN lockout early",
      secure: initiallyLocked && stillLocked,
      observed: `before=${beforeAdvance.ok ? "accepted" : beforeAdvance.reason}; after=${
        afterAdvance.ok ? "accepted" : afterAdvance.reason
      }`,
    };
  } finally {
    Date.now = originalNow;
  }
}

async function corruptRegistryDoesNotBecomeEmpty(): Promise<Check> {
  const originalActive = "wallet-a";
  const { storage, values } = memoryStorage({
    [WALLET_STORAGE_KEYS.registry]: "{ malformed wallet registry",
    [WALLET_STORAGE_KEYS.activeWalletId]: originalActive,
  });

  const secrets: SecretStore = {
    async load() {
      return null;
    },
    async save() {
      return { durable: true };
    },
    async remove() {},
    async discardStaged() {},
  };

  const engine = createWalletEngine({ storage, secrets, random });
  const report = await engine.initialize();
  const activeAfter = values.get(WALLET_STORAGE_KEYS.activeWalletId) ?? null;
  const registryAfter = values.get(WALLET_STORAGE_KEYS.registry) ?? null;

  const secure =
    report.status === "degraded" &&
    activeAfter === originalActive &&
    registryAfter === "{ malformed wallet registry";

  return {
    name: "corrupt wallet registry is not treated as an empty wallet set",
    secure,
    observed: `status=${report.status}; activePreserved=${String(
      activeAfter === originalActive,
    )}; registryPreserved=${String(
      registryAfter === "{ malformed wallet registry",
    )}`,
  };
}

// VS-C04: before the fix, a first wallet was written to the registry and made
// active while its phrase sat in a module-level map. Killing the process
// before the PIN existed left a wallet that was visible, selectable and
// unusable. Nothing may be committed against a non-durable secret.
async function nonDurableSecretCommitsNothing(): Promise<Check> {
  const { storage, values } = memoryStorage();

  const staged = new Map<string, unknown>();

  const secrets: SecretStore = {
    async load() {
      return null;
    },
    async save(walletId, secret) {
      // Exactly what the platform store does with no vault key: memory only.
      staged.set(walletId, secret);

      return { durable: false };
    },
    async remove(walletId) {
      staged.delete(walletId);
    },
    async discardStaged(walletId) {
      staged.delete(walletId);
    },
  };

  const engine = createWalletEngine({ storage, secrets, random });

  let caught: unknown = null;

  try {
    await engine.create(
      "test test test test test test test test test test test junk",
    );
  } catch (error) {
    caught = error;
  }

  const registryAfter = values.get(WALLET_STORAGE_KEYS.registry) ?? null;
  const activeAfter = values.get(WALLET_STORAGE_KEYS.activeWalletId) ?? null;
  const journalAfter = values.get(WALLET_STORAGE_KEYS.journal) ?? null;

  const refused =
    caught instanceof Error && caught.name === "WalletSecretNotDurableError";

  return {
    name: "a wallet whose phrase has nowhere durable to live is not committed",
    secure:
      refused &&
      registryAfter === null &&
      activeAfter === null &&
      journalAfter === null &&
      staged.size === 0,
    observed: `error=${
      caught instanceof Error ? caught.name : "none"
    }; registry=${registryAfter === null ? "unwritten" : "written"}; active=${
      activeAfter === null ? "unset" : "set"
    }; journal=${journalAfter === null ? "clear" : "left behind"}; staged=${staged.size}`,
  };
}

// The rollback above must not become its own disaster: re-importing a phrase
// that already has a registered wallet, while the vault is closed, hits the
// same non-durable branch. If that path deletes durable storage it destroys
// the only copy of a live wallet's phrase — strictly worse than the zombie
// wallet the fix was for.
async function rollbackNeverTouchesAnExistingSecret(): Promise<Check> {
  const mnemonic =
    "test test test test test test test test test test test junk";

  const durable = new Map<string, unknown>();
  const staged = new Map<string, unknown>();

  let vaultOpen = true;

  const secrets: SecretStore = {
    async load(walletId) {
      return (durable.get(walletId) as never) ?? null;
    },
    async save(walletId, secret) {
      if (!vaultOpen) {
        staged.set(walletId, secret);

        return { durable: false };
      }

      durable.set(walletId, secret);

      return { durable: true };
    },
    async remove(walletId) {
      staged.delete(walletId);
      durable.delete(walletId);
    },
    async discardStaged(walletId) {
      staged.delete(walletId);
    },
  };

  const { storage, values } = memoryStorage();

  const engine = createWalletEngine({ storage, secrets, random });

  const wallet = await engine.create(mnemonic);

  const registryAfterCreate = values.get(WALLET_STORAGE_KEYS.registry) ?? null;

  // The vault closes (process restarted, app locked), and the same phrase is
  // imported again.
  vaultOpen = false;

  let caught: unknown = null;

  try {
    await engine.importFromMnemonic(mnemonic);
  } catch (error) {
    caught = error;
  }

  const refused =
    caught instanceof Error && caught.name === "WalletSecretNotDurableError";

  const secretSurvived = durable.has(wallet.id);

  const registrySurvived =
    (values.get(WALLET_STORAGE_KEYS.registry) ?? null) === registryAfterCreate;

  return {
    name: "abandoning a non-durable save never deletes an existing wallet's phrase",
    secure: refused && secretSurvived && registrySurvived && staged.size === 0,
    observed: `error=${
      caught instanceof Error ? caught.name : "none"
    }; durableSecret=${secretSurvived ? "kept" : "DELETED"}; registry=${
      registrySurvived ? "kept" : "changed"
    }; staged=${staged.size}`,
  };
}

async function activeWalletChangeStopsSigning(): Promise<Check> {
  const prepared: PreparedNativeTransfer = {
    kind: "native-transfer",
    type: "eip1559",
    chainId: 1,
    from: "0x1111111111111111111111111111111111111111",
    to: "0x3333333333333333333333333333333333333333",
    value: 1n,
    nonce: 0,
    gas: 21_000n,
    maxFeePerGas: 10_000_000_000n,
    maxPriorityFeePerGas: 1_000_000_000n,
    data: "0x",
  };
  let signReached = false;
  const signer: WalletSigner = {
    async getAddress() {
      return "0x2222222222222222222222222222222222222222";
    },
    async signMessage() {
      throw new Error("message signing is outside this check");
    },
    async signTransaction() {
      signReached = true;
      throw new Error("signed despite an active-wallet mismatch");
    },
  };
  const authorization = "audit-active-wallet-change";
  let caught: unknown = null;

  unlockSession();
  grantTransactionAuthorization(prepared, authorization);

  try {
    await signNativeTransfer(
      { transaction: prepared, authorization, expectedChainId: 1 },
      signer,
    );
  } catch (error) {
    caught = error;
  } finally {
    lockSession();
  }

  const secure =
    caught instanceof TransactionValidationError &&
    caught.code === "INVALID_FROM" &&
    !signReached;

  return {
    name: "active-wallet change between preview and sign is rejected",
    secure,
    observed: `error=${
      caught instanceof TransactionValidationError ? caught.code : "none"
    }; signerReached=${String(signReached)}`,
  };
}

export async function main() {
  const checks = await Promise.all([
    malformedAttemptCounterFailsClosed(),
    concurrentWrongPinsConsumeAttempts(),
    wallClockAdvanceDoesNotBypassLockout(),
    corruptRegistryDoesNotBecomeEmpty(),
    nonDurableSecretCommitsNothing(),
    rollbackNeverTouchesAnExistingSecret(),
    activeWalletChangeStopsSigning(),
  ]);

  for (const check of checks) {
    console.log(
      `${check.secure ? "ok  " : "FAIL"} ${check.name} — ${check.observed}`,
    );
  }

  const failed = checks.filter((check) => !check.secure);
  console.log(`\n${failed.length} security regression(s) reproduced`);

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}
