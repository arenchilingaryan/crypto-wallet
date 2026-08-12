import { ActivityIndicator, Pressable, TextInput, View } from "react-native";

import { AssetIcon } from "@/components/asset-icon";
import { SwapIcon } from "@/components/icons/swap-icon";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/ui/footer";
import { Screen } from "@/components/ui/screen";
import { AppText } from "@/components/ui/text";

import { Colors } from "@/constants/theme";

import { styles } from "./swap-view.styles";

export type SwapSide = {
  symbol: string | null;

  name: string | null;

  logo: string | null;

  amount: string;

  balance: string | null;

  /** Нативной монете рисуется её собственная иконка, а не инициалы. */
  type?: "native" | "erc20";
};

type SwapViewProps = {
  pay?: SwapSide;

  receive?: SwapSide;

  rate?: string;

  networkFee?: string;

  slippage?: string;

  route?: string;

  error?: string | null;

  quoteLoading?: boolean;

  submitLabel?: string;

  canSubmit?: boolean;

  onChangePayAmount?: (value: string) => void;

  onSelectPayToken?: () => void;

  onSelectReceiveToken?: () => void;

  onFlip?: () => void;

  onSubmit?: () => void;

  onBack?: () => void;
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

  // Платёжная сторона редактируется; получаемая — только показывает котировку.
  onChangeAmount?: (value: string) => void;

  amountLoading?: boolean;
};

function TokenCard({
  label,
  side,
  onSelectToken,
  onChangeAmount,
  amountLoading = false,
}: TokenCardProps) {
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
            type={side.type ?? "erc20"}
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
          {onChangeAmount ? (
            <TextInput
              value={side.amount}
              onChangeText={onChangeAmount}
              placeholder="0"
              placeholderTextColor={Colors.textMuted}
              keyboardType="decimal-pad"
              inputMode="decimal"
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel={`${label} amount`}
              style={styles.amountInput}
            />
          ) : amountLoading ? (
            <ActivityIndicator color={Colors.textSecondary} />
          ) : (
            <AppText variant="title" tone="paper" tabular numberOfLines={1}>
              {side.amount}
            </AppText>
          )}

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
  route,
  error = null,
  quoteLoading = false,
  submitLabel = "Swap",
  canSubmit = false,
  onChangePayAmount,
  onSelectPayToken,
  onSelectReceiveToken,
  onFlip,
  onSubmit,
  onBack,
}: SwapViewProps) {
  return (
    <Screen scroll onBack={onBack}>
      <AppText variant="title" tone="paper" style={styles.heading}>
        Swap
      </AppText>

      <TokenCard
        label="You pay"
        side={pay}
        onSelectToken={onSelectPayToken}
        onChangeAmount={onChangePayAmount}
      />

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
        amountLoading={quoteLoading}
      />

      {error && (
        <AppText variant="caption" tone="danger" style={styles.error}>
          {error}
        </AppText>
      )}

      <View style={styles.info}>
        <View style={styles.infoRow}>
          <AppText variant="caption" tone="muted">
            Rate
          </AppText>

          <AppText variant="caption" tone="secondary" tabular>
            {rate}
          </AppText>
        </View>

        {route && (
          <View style={styles.infoRow}>
            <AppText variant="caption" tone="muted">
              Route
            </AppText>

            <AppText variant="caption" tone="secondary">
              {route}
            </AppText>
          </View>
        )}

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
          title={submitLabel}
          onPress={onSubmit ?? (() => {})}
          disabled={!canSubmit || !onSubmit}
        />
      </Footer>
    </Screen>
  );
}
