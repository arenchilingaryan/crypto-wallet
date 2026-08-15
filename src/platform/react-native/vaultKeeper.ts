import {
  openOrCreateVault,
  stageRotation,
  type SlotStore,
} from "@/core/wallet/vaultSlots";

import { parseWalletVault } from "@/core/wallet/walletVault";

import {
  createPinVerifierV3,
  deriveVaultPinKey,
  parsePinVerifier,
  serializePinVerifier,
  type PinVerifier,
} from "@/core/security/pinVerifier";

import { SECURITY_STORAGE_KEYS } from "@/core/security/security.constants";

import { walletEngine } from "./compositionRoot";
import { getDeviceKey, hasDeviceKey } from "./deviceKey";
import { expoKeyValueStorage } from "./keyValueStorage";
import { expoRandomSource } from "./expoRandomSource";
import { pendingSecretEntries } from "./pendingSecrets";
import { expoSecretStore } from "./secretStore";
import { getUnlockMaterial, setUnlockMaterial } from "./unlockMaterial";

const VAULT_SLOT_KEY = "security.vault-slot.v2";

const VAULT_SLOT_PENDING_KEY = "security.vault-slot-pending.v2";

const slots: SlotStore = {
  readSlot: () => expoKeyValueStorage.get(VAULT_SLOT_KEY),

  writeSlot: (value) => expoKeyValueStorage.set(VAULT_SLOT_KEY, value),

  readPending: () => expoKeyValueStorage.get(VAULT_SLOT_PENDING_KEY),

  writePending: (value) =>
    expoKeyValueStorage.set(VAULT_SLOT_PENDING_KEY, value),

  removePending: () => expoKeyValueStorage.remove(VAULT_SLOT_PENDING_KEY),
};

function toHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function readVerifier(): Promise<PinVerifier | null> {
  return parsePinVerifier(
    await expoKeyValueStorage.get(SECURITY_STORAGE_KEYS.pinVerifier),
  );
}

async function ensureVaultSalt(verifier: PinVerifier): Promise<string> {
  if (verifier.vaultSalt) {
    return verifier.vaultSalt;
  }

  const vaultSalt = toHex(await expoRandomSource.getBytes(16));

  await expoKeyValueStorage.set(
    SECURITY_STORAGE_KEYS.pinVerifier,
    serializePinVerifier({ ...verifier, vaultSalt }),
  );

  return vaultSalt;
}

export async function adoptPin(
  pin: string,
  // Supplied when the PIN check already derived it (verifier v3). Reusing it is
  // the entire point of v3: one password KDF per unlock instead of two.
  derivedPinKey?: Uint8Array,
): Promise<boolean> {
  const verifier = await readVerifier();

  if (!verifier) {
    return false;
  }

  const vaultSalt = await ensureVaultSalt(verifier);

  const pinKey = derivedPinKey ?? deriveVaultPinKey(pin, vaultSalt);

  if ((await slots.readSlot()) !== null && !(await hasDeviceKey())) {
    throw new Error(
      "This device's wallet key is gone, so your wallets cannot be opened here. Restore them from their recovery phrase.",
    );
  }

  const { masterKey } = await openOrCreateVault({
    slots,
    deviceKey: await getDeviceKey(),
    pinKey,
    random: expoRandomSource,
    sealedWalletsExist: await anyWalletSealed(),
  });

  setUnlockMaterial(masterKey);

  // Only now — the vault actually opened with this key, so a verifier derived
  // from it is guaranteed to agree with the vault. Migrating any earlier could
  // write a check value that no longer matches what unlocks the wallet.
  await migrateVerifierToV3(verifier, vaultSalt, pinKey);

  await flushPendingSecrets();

  return true;
}

async function migrateVerifierToV3(
  verifier: PinVerifier,
  vaultSalt: string,
  pinKey: Uint8Array,
): Promise<void> {
  if (verifier.version === 3) {
    return;
  }

  try {
    await expoKeyValueStorage.set(
      SECURITY_STORAGE_KEYS.pinVerifier,
      serializePinVerifier(createPinVerifierV3(vaultSalt, pinKey)),
    );
  } catch (error) {
    // An interrupted migration is harmless: the v2 verifier is still there and
    // still correct, so the next unlock simply pays for two derivations again.
    console.error("Could not upgrade the stored PIN check:", error);
  }
}

async function flushPendingSecrets(): Promise<void> {
  for (const [walletId, secret] of pendingSecretEntries()) {
    try {
      await expoSecretStore.save(walletId, secret);
    } catch (error) {
      console.error(`Could not seal wallet ${walletId} on unlock:`, error);
    }
  }

  try {
    await walletEngine.finishLegacyMigration();
  } catch (error) {
    console.error("Could not finish the legacy wallet migration:", error);
  }
}

export async function sealEveryWallet(): Promise<void> {
  try {
    if (!getUnlockMaterial()) {
      return;
    }

    const wallets = await walletEngine.list();

    for (const wallet of wallets) {
      try {
        if (await isSealed(wallet.id)) {
          continue;
        }

        const secret = await expoSecretStore.load(wallet.id);

        if (secret) {
          await expoSecretStore.save(wallet.id, secret);
        }
      } catch (error) {
        console.error(`Could not protect wallet ${wallet.id}:`, error);
      }
    }
  } catch (error) {
    console.error("Protecting wallets failed:", error);
  }
}

async function anyWalletSealed() {
  try {
    const wallets = await walletEngine.list();

    for (const wallet of wallets) {
      const raw = await expoSecretStore.peek(wallet.id);

      if (raw && parseWalletVault(JSON.parse(raw))) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

async function isSealed(walletId: string) {
  const raw = await expoSecretStore.peek(walletId);

  if (!raw) {
    return true;
  }

  try {
    return parseWalletVault(JSON.parse(raw)) !== null;
  } catch {
    return false;
  }
}

export async function stageNewPin(nextPin: string): Promise<string> {
  const verifier = await readVerifier();

  const masterKey = getUnlockMaterial();

  if (!verifier || !masterKey) {
    throw new Error(
      "Your wallets are locked, so the PIN cannot be changed right now. Unlock and try again.",
    );
  }

  const vaultSalt = await ensureVaultSalt(verifier);

  await stageRotation({
    slots,
    deviceKey: await getDeviceKey(),
    masterKey,
    nextPinKey: deriveVaultPinKey(nextPin, vaultSalt),
    random: expoRandomSource,
  });

  return vaultSalt;
}
