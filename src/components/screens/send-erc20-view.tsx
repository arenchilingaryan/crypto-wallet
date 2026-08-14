import { Pressable, TextInput, View } from "react-native";

import { SecurityBriefing } from "@/components/security/security-briefing";
import { Screen } from "@/components/ui/screen";
import { AppText } from "@/components/ui/text";

import type { SecurityReview } from "@/core/security/securityReview";

import { styles } from "./send-erc20-view.styles";

type SendErc20ViewProps = {
  symbol: string;

  to: string;
  amount: string;

  review: SecurityReview | null;

  error: string | null;
  loading: boolean;

  onChangeTo: (value: string) => void;

  onChangeAmount: (value: string) => void;

  onContinue: () => void;
  onBack: () => void;

  balanceToken: string | null;
  networkFeeEth: string | null;

  quoteLoading: boolean;

  canContinue: boolean;
};

export function SendErc20View({
  symbol,
  to,
  amount,
  review,
  error,
  loading,

  onChangeTo,
  onChangeAmount,

  onContinue,
  onBack,

  balanceToken,
  networkFeeEth,
  quoteLoading,

  canContinue,
}: SendErc20ViewProps) {
  return (
    <Screen>
      <View style={styles.header}>
        <Pressable
          onPress={onBack}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}
        >
          <AppText variant="label">Back</AppText>
        </Pressable>

        <AppText variant="heading">Send {symbol}</AppText>
      </View>

      <View style={styles.form}>
        <View style={styles.field}>
          <AppText variant="caption" tone="muted">
            Recipient
          </AppText>

          <TextInput
            value={to}
            onChangeText={onChangeTo}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="0x..."
            placeholderTextColor="#66666D"
            style={styles.input}
          />
        </View>

        <View style={styles.field}>
          <AppText variant="caption" tone="muted">
            Amount
          </AppText>

          <TextInput
            value={amount}
            onChangeText={onChangeAmount}
            keyboardType="decimal-pad"
            placeholder="0.0"
            placeholderTextColor="#66666D"
            style={styles.input}
          />

          <AppText variant="caption" tone="muted">
            {symbol}
          </AppText>
        </View>

        <View style={styles.costInfo}>
          {quoteLoading ? (
            <AppText variant="caption" tone="muted">
              Estimating network fee…
            </AppText>
          ) : (
            <>
              {networkFeeEth && (
                <View style={styles.costRow}>
                  <AppText variant="caption" tone="muted">
                    Max network fee
                  </AppText>

                  <AppText variant="caption" tone="secondary" tabular>
                    {networkFeeEth} ETH
                  </AppText>
                </View>
              )}

              {balanceToken && (
                <View style={styles.costRow}>
                  <AppText variant="caption" tone="muted">
                    Available
                  </AppText>

                  <AppText variant="caption" tone="secondary" tabular>
                    {balanceToken} {symbol}
                  </AppText>
                </View>
              )}
            </>
          )}
        </View>

        {review && review.decision.decision === "block" && (
          <SecurityBriefing review={review} />
        )}

        {error && (
          <AppText variant="caption" tone="danger">
            {error}
          </AppText>
        )}

        <Pressable
          disabled={loading || !canContinue}
          onPress={onContinue}
          style={({ pressed }) => [
            styles.continueButton,
            pressed && styles.pressed,
            (loading || !canContinue) && styles.disabled,
          ]}
        >
          <AppText variant="label">
            {loading
              ? "Checking this transfer…"
              : review?.decision.decision === "block"
                ? "This wallet will not sign this"
                : "Continue"}
          </AppText>
        </Pressable>
      </View>
    </Screen>
  );
}
