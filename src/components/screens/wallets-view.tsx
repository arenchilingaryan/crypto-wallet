import { Pressable, View } from "react-native";

import { Screen } from "@/components/ui/screen";
import { AppText } from "@/components/ui/text";
import type { WalletRecord } from "@/core/wallet/walletStore";
import { shortenAddress } from "@/utils/format";

import { styles } from "./wallets-view.styles";

type WalletsViewProps = {
  wallets: WalletRecord[];
  activeWalletId: string | null;
  error: string | null;

  onSelect: (walletId: string) => void;
  onCreate: () => void;
  onImport: () => void;
  onRemove: (wallet: WalletRecord) => void;
  onBack: () => void;
};

export function WalletsView({
  wallets,
  activeWalletId,
  error,
  onSelect,
  onCreate,
  onImport,
  onRemove,
  onBack,
}: WalletsViewProps) {
  return (
    <Screen onBack={onBack}>
      <AppText variant="heading" tone="paper">
        My wallets
      </AppText>

      {error && (
        <AppText variant="caption" tone="danger" style={styles.error}>
          {error}
        </AppText>
      )}

      <View style={styles.walletList}>
        {wallets.map((wallet) => {
          const active = wallet.id === activeWalletId;

          return (
            <View key={wallet.id} style={styles.walletRow}>
              <Pressable
                onPress={() => onSelect(wallet.id)}
                style={({ pressed }) => [
                  styles.walletMain,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.walletTitle}>
                  <AppText variant="bodyStrong">{wallet.name}</AppText>

                  {active && (
                    <View style={styles.activeBadge}>
                      <AppText variant="caption" tone="secondary">
                        Active
                      </AppText>
                    </View>
                  )}
                </View>

                <AppText variant="caption" tone="muted" mono>
                  {shortenAddress(wallet.address)}
                </AppText>
              </Pressable>

              <Pressable
                onPress={() => onRemove(wallet)}
                style={({ pressed }) => [
                  styles.removeButton,
                  pressed && styles.pressed,
                ]}
              >
                <AppText variant="caption" tone="danger">
                  Remove
                </AppText>
              </Pressable>
            </View>
          );
        })}
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={onCreate}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <AppText variant="label">Create wallet</AppText>
        </Pressable>

        <Pressable
          onPress={onImport}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <AppText variant="label">Import wallet</AppText>
        </Pressable>
      </View>
    </Screen>
  );
}
