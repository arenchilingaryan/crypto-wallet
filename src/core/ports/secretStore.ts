import type { WalletSecret } from "@/core/wallet/walletSecret";

export type SecretSaveResult = {
  /**
   * True when the secret was written to durable storage (sealed).
   * False when it was only staged in memory because the vault is not open
   * yet — the caller must keep any other durable copy until a later save
   * reports `durable: true`.
   */
  durable: boolean;
};

export interface SecretStore {
  load(walletId: string): Promise<WalletSecret | null>;

  save(walletId: string, secret: WalletSecret): Promise<SecretSaveResult>;

  remove(walletId: string): Promise<void>;
}
