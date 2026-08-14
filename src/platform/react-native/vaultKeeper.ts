import {
  openOrCreateVault,
  stageRotation,
  type SlotStore,
} from "@/core/wallet/vaultSlots";

import { parseWalletVault } from "@/core/wallet/walletVault";

import {
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

export async function adoptPin(pin: string): Promise<boolean> {
  const verifier = await readVerifier();

  if (!verifier) {
    return false;
  }

  const pinKey = deriveVaultPinKey(pin, await ensureVaultSalt(verifier));

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

  return true;
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
