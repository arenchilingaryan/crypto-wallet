export type WalletSecret = {
  version: 1;

  mnemonic: string;
};

export function createWalletSecret(mnemonic: string): WalletSecret {
  return {
    version: 1,

    mnemonic,
  };
}

export function serializeWalletSecret(secret: WalletSecret): string {
  return JSON.stringify(secret);
}

export function parseWalletSecret(raw: string): WalletSecret | null {
  const value = raw.trim();

  if (!value) {
    return null;
  }

  if (!value.startsWith("{")) {
    return createWalletSecret(value);
  }

  try {
    const parsed = JSON.parse(value) as Partial<WalletSecret>;

    if (parsed.version !== 1 || typeof parsed.mnemonic !== "string") {
      return null;
    }

    return {
      version: 1,

      mnemonic: parsed.mnemonic,
    };
  } catch {
    return null;
  }
}
