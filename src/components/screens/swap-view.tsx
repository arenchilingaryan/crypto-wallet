import { Pressable, View } from "react-native";

import { AssetIcon } from "@/components/asset-icon";
import { SwapIcon } from "@/components/icons/swap-icon";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/ui/footer";
import { Screen } from "@/components/ui/screen";
import { AppText } from "@/components/ui/text";

import { Colors } from "@/constants/theme";

import { styles } from "./swap-view.styles";

// Чистый UI без логики: колбэки опциональны, чтобы подключить обмен позже,
// не перекраивая разметку.
export type SwapSide = {
  symbol: string | null;

  name: string | null;

  logo: string | null;

  amount: string;

  balance: string | null;
};

type SwapViewProps = {
  pay?: SwapSide;

  receive?: SwapSide;

  rate?: string;

  networkFee?: string;

  slippage?: string;

  onSelectPayToken?: () => void;

  onSelectReceiveToken?: () => void;

  onFlip?: () => void;

  onSubmit?: () => void;
};

const EMPTY_SIDE: SwapSide = {
  symbol: null,

  name: null,

  logo: null,

  amount: "0",

  balance: null,
};

type TokenCardProps = {
  label: string;

  side: SwapSide;

  onSelectToken?: () => void;
};

function TokenCard({ label, side, onSelectToken }: TokenCardProps) {
  return (
    <View style={styles.card}>
      <AppText variant="overline" tone="muted">
        {label}
      </AppText>

      <View style={styles.cardRow}>
        <Pressable
          onPress={onSelectToken}
          disabled={!onSelectToken}
          accessibilityRole="button"
          accessibilityLabel={`Select ${label.toLowerCase()} token`}
          style={({ pressed }) => [
            styles.tokenSelector,

            pressed && onSelectToken ? styles.tokenSelectorPressed : undefined,
          ]}
        >
          <AssetIcon
            symbol={side.symbol ?? "?"}
            logo={side.logo}
            type="erc20"
            size={36}
          />

          <View style={styles.tokenName}>
            <AppText variant="bodyStrong">
              {side.symbol ?? "Select token"}
            </AppText>

            {side.name && (
              <AppText variant="caption" tone="muted" numberOfLines={1}>
                {side.name}
              </AppText>
            )}
          </View>
        </Pressable>

        <View style={styles.amount}>
          <AppText variant="title" tone="paper" tabular numberOfLines={1}>
            {side.amount}
          </AppText>

          <AppText variant="caption" tone="muted" tabular>
            Balance: {side.balance ?? "—"}
          </AppText>
        </View>
      </View>
    </View>
  );
}

export function SwapView({
  pay = EMPTY_SIDE,
  receive = EMPTY_SIDE,
  rate = "—",
  networkFee = "—",
  slippage = "—",
  onSelectPayToken,
  onSelectReceiveToken,
  onFlip,
  onSubmit,
}: SwapViewProps) {
  return (
    <Screen scroll>
      <AppText variant="title" tone="paper" style={styles.heading}>
        Swap
      </AppText>

      <TokenCard label="You pay" side={pay} onSelectToken={onSelectPayToken} />

      <View style={styles.flipRow}>
        <Pressable
          onPress={onFlip}
          disabled={!onFlip}
          accessibilityRole="button"
          accessibilityLabel="Flip swap direction"
          style={({ pressed }) => [
            styles.flipButton,

            pressed && onFlip ? styles.flipButtonPressed : undefined,
          ]}
        >
          <SwapIcon size={18} color={Colors.textPrimary} />
        </Pressable>
      </View>

      <TokenCard
        label="You receive"
        side={receive}
        onSelectToken={onSelectReceiveToken}
      />

      <View style={styles.info}>
        <View style={styles.infoRow}>
          <AppText variant="caption" tone="muted">
            Rate
          </AppText>

          <AppText variant="caption" tone="secondary" tabular>
            {rate}
          </AppText>
        </View>

        <View style={styles.infoRow}>
          <AppText variant="caption" tone="muted">
            Network fee
          </AppText>

          <AppText variant="caption" tone="secondary" tabular>
            {networkFee}
          </AppText>
        </View>

        <View style={styles.infoRow}>
          <AppText variant="caption" tone="muted">
            Slippage
          </AppText>

          <AppText variant="caption" tone="secondary" tabular>
            {slippage}
          </AppText>
        </View>
      </View>

      <Footer>
        <Button
          title="Swap"
          onPress={onSubmit ?? (() => {})}
          disabled={!onSubmit}
        />
      </Footer>
    </Screen>
  );
}
