import {
  parseVaultKeySlot,
  serializeVaultKeySlot,
  unwrapMasterKey,
  VaultKeyError,
  wrapMasterKey,
} from "./vaultMasterKey";

export type SlotStore = {
  readSlot(): Promise<string | null>;

  writeSlot(value: string): Promise<void>;

  readPending(): Promise<string | null>;

  writePending(value: string): Promise<void>;

  removePending(): Promise<void>;
};

export type SlotRandom = {
  getBytes(length: number): Promise<Uint8Array>;
};

async function buildSlot({
  masterKey,
  deviceKey,
  pinKey,
  random,
}: {
  masterKey: Uint8Array;
  deviceKey: Uint8Array;
  pinKey: Uint8Array;
  random: SlotRandom;
}) {
  const [kekSalt, wrapNonce] = await Promise.all([
    random.getBytes(16),
    random.getBytes(24),
  ]);

  return serializeVaultKeySlot(
    wrapMasterKey({ masterKey, deviceKey, pinKey, kekSalt, wrapNonce }),
  );
}

export async function openOrCreateVault({
  slots,
  deviceKey,
  pinKey,
  random,
  sealedWalletsExist = false,
}: {
  slots: SlotStore;
  deviceKey: Uint8Array;
  pinKey: Uint8Array;
  random: SlotRandom;
  sealedWalletsExist?: boolean;
}): Promise<{ masterKey: Uint8Array; created: boolean; promoted: boolean }> {
  const rawSlot = await slots.readSlot();

  const slot = parseVaultKeySlot(rawSlot);

  if (!slot) {
    if (rawSlot !== null && rawSlot.trim() !== "") {
      throw new VaultKeyError(
        "The stored wallet key is damaged. Restore your wallets from their recovery phrase.",
      );
    }

    if (sealedWalletsExist) {
      throw new VaultKeyError(
        "The key that opens your wallets is missing on this device. Restore them from their recovery phrase.",
      );
    }

    const masterKey = await random.getBytes(32);

    await slots.writeSlot(
      await buildSlot({ masterKey, deviceKey, pinKey, random }),
    );

    await slots.removePending();

    return { masterKey, created: true, promoted: false };
  }

  try {
    const masterKey = unwrapMasterKey({ slot, deviceKey, pinKey });

    await slots.removePending();

    return { masterKey, created: false, promoted: false };
  } catch (error) {
    const pendingRaw = await slots.readPending();

    const pending = parseVaultKeySlot(pendingRaw);

    if (!pending || !pendingRaw) {
      throw error instanceof VaultKeyError
        ? error
        : new VaultKeyError("The stored wallet key could not be opened");
    }

    const masterKey = unwrapMasterKey({ slot: pending, deviceKey, pinKey });

    await slots.writeSlot(pendingRaw);

    await slots.removePending();

    return { masterKey, created: false, promoted: true };
  }
}

export async function stageRotation({
  slots,
  deviceKey,
  masterKey,
  nextPinKey,
  random,
}: {
  slots: SlotStore;
  deviceKey: Uint8Array;
  masterKey: Uint8Array;
  nextPinKey: Uint8Array;
  random: SlotRandom;
}): Promise<void> {
  await slots.writePending(
    await buildSlot({ masterKey, deviceKey, pinKey: nextPinKey, random }),
  );
}
