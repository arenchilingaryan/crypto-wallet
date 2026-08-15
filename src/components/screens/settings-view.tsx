import Feather from "@expo/vector-icons/Feather";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { Screen } from "@/components/ui/screen";
import { AppText } from "@/components/ui/text";

import { Colors } from "@/constants/theme";

import { styles } from "./settings-view.styles";

type SettingsViewProps = {
  networkName: string;

  version: string;

  onManageWallets: () => void;

  onChangePin: () => void;

  onOpenLimits: () => void;

  onRevealPhrase: () => void;

  onRepairRecords: () => void;

  onBack?: () => void;
};

type SettingsRowProps = {
  title: string;

  subtitle?: string;

  divider?: boolean;

  onPress?: () => void;

  right?: ReactNode;
};

function SettingsRow({
  title,
  subtitle,
  divider = false,
  onPress,
  right,
}: SettingsRowProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.row,
        divider && styles.rowDivider,
        pressed && onPress ? styles.rowPressed : undefined,
      ]}
    >
      <View style={styles.rowText}>
        <AppText variant="bodyStrong">{title}</AppText>

        {subtitle && (
          <AppText variant="caption" tone="muted">
            {subtitle}
          </AppText>
        )}
      </View>

      {right ??
        (onPress && (
          <Feather name="chevron-right" size={18} color={Colors.textMuted} />
        ))}
    </Pressable>
  );
}

type SettingsSectionProps = {
  title: string;

  children: ReactNode;
};

function SettingsSection({ title, children }: SettingsSectionProps) {
  return (
    <View style={styles.section}>
      <AppText variant="overline" tone="muted">
        {title}
      </AppText>

      <View style={styles.card}>{children}</View>
    </View>
  );
}

export function SettingsView({
  networkName,
  version,
  onManageWallets,
  onChangePin,
  onOpenLimits,
  onRevealPhrase,
  onRepairRecords,
  onBack,
}: SettingsViewProps) {
  return (
    <Screen scroll onBack={onBack}>
      <AppText variant="title" tone="paper" style={styles.heading}>
        Settings
      </AppText>

      <SettingsSection title="Wallets">
        <SettingsRow
          title="Manage wallets"
          subtitle="Switch, add or remove wallets"
          onPress={onManageWallets}
        />
      </SettingsSection>

      <SettingsSection title="Security">
        <SettingsRow
          title="Transaction limits"
          subtitle="Cap the dollar value of a single transfer"
          onPress={onOpenLimits}
        />

        <SettingsRow
          title="Recovery phrase and private key"
          subtitle="Show the words that restore this wallet"
          onPress={onRevealPhrase}
        />

        <SettingsRow
          title="Change PIN"
          subtitle="Update the 6-digit code protecting this wallet"
          divider
          onPress={onChangePin}
        />

        <SettingsRow
          title="Repair local records"
          subtitle="What to do when this device cannot read its own transaction record"
          divider
          onPress={onRepairRecords}
        />
      </SettingsSection>

      <SettingsSection title="About">
        <SettingsRow
          title="Network"
          right={
            <AppText variant="label" tone="secondary">
              {networkName}
            </AppText>
          }
        />

        <SettingsRow
          title="Version"
          divider
          right={
            <AppText variant="label" tone="secondary" tabular>
              {version}
            </AppText>
          }
        />
      </SettingsSection>
    </Screen>
  );
}
