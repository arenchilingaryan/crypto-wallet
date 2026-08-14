import type { WalletSecret } from "@/core/wallet/walletSecret";

export interface SecretStore {
  load(walletId: string): Promise<WalletSecret | null>;

  save(walletId: string, secret: WalletSecret): Promise<void>;

  remove(walletId: string): Promise<void>;
}
