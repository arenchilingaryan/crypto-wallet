import { useState } from "react";

import { useRouter } from "expo-router";

import { ActivityIndicator, Pressable, View } from "react-native";

import * as Clipboard from "expo-clipboard";

import type { Address } from "viem";

import { AddressPill } from "@/components/address-pill";
import { AssetRow } from "@/components/asset-row";

import { CopyIcon } from "@/components/icons/copy-icon";
import { ReceiveIcon } from "@/components/icons/receive-icon";
import { SearchIcon } from "@/components/icons/search-icon";
import { SendIcon } from "@/components/icons/send-icon";
import { SettingsIcon } from "@/components/icons/settings-icon";
import { SwapIcon } from "@/components/icons/swap-icon";

import { ChangeBadge } from "@/components/ui/change-badge";
import { QuickAction } from "@/components/ui/quick-action";
import { Screen } from "@/components/ui/screen";
import { AppText } from "@/components/ui/text";

import { Colors } from "@/constants/theme";

import type { Portfolio } from "@/core/blockchain/getPortfolio";
import {
  assetKey,
  type PortfolioChange,
} from "@/core/blockchain/getPortfolioChange";

import { formatUsd } from "@/utils/format";

import { styles } from "./home-view.styles";

type HomeViewProps = {
  address: Address;

  walletName: string | null;

  portfolio: Portfolio | null;

  change: PortfolioChange | null;

  error: string | null;
};

export function HomeView({
  address,
  walletName,
  portfolio,
  change,
  error,
}: HomeViewProps) {
  const router = useRouter();

  const [addressCopied, setAddressCopied] = useState(false);

  async function copyAddress() {
    await Clipboard.setStringAsync(address);

    setAddressCopied(true);

    setTimeout(() => {
      setAddressCopied(false);
    }, 1500);
  }

  return (
    <Screen scroll>
      <View style={styles.header}>
        <View style={styles.identity}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Switch wallet"
            onPress={() => {
              router.push("/wallets");
            }}
            style={({ pressed }) => [
              styles.walletButton,
              pressed && styles.pressed,
            ]}
          >
            <AppText variant="heading" tone="paper">
              {walletName ?? "Wallet"}
            </AppText>

            <AppText variant="caption" tone="muted">
              ▾
            </AppText>
          </Pressable>

          <View style={styles.addressActions}>
            <AddressPill address={address} />

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                addressCopied ? "Address copied" : "Copy wallet address"
              }
              onPress={() => {
                void copyAddress();
              }}
              style={({ pressed }) => [
                styles.copyIconButton,
                pressed && styles.pressed,
              ]}
            >
              <CopyIcon
                size={17}
                color={
                  addressCopied ? Colors.textSecondary : Colors.textPrimary
                }
              />
            </Pressable>

            {addressCopied && (
              <AppText variant="caption" tone="muted">
                Copied
              </AppText>
            )}
          </View>
        </View>

        <View style={styles.headerButtons}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Search assets"
            onPress={() => {
              router.push("/search");
            }}
            style={({ pressed }) => [
              styles.iconButton,
              pressed && styles.pressed,
            ]}
          >
            <SearchIcon size={20} color={Colors.textPrimary} />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Settings"
            onPress={() => {
              router.push("/settings");
            }}
            style={({ pressed }) => [
              styles.iconButton,
              pressed && styles.pressed,
            ]}
          >
            <SettingsIcon size={20} color={Colors.textPrimary} />
          </Pressable>
        </View>
      </View>

      <View style={styles.balance}>
        <AppText variant="overline" tone="muted">
          Total balance
        </AppText>

        <AppText
          variant="display"
          tone="paper"
          tabular
          style={styles.balanceValue}
        >
          {portfolio ? formatUsd(portfolio.totalUsd) : "—"}
        </AppText>

        <ChangeBadge
          changePercent={change?.totalChangePercent ?? null}
          period="24h"
        />
      </View>

      <View style={styles.actions}>
        <QuickAction
          label="Send"
          icon={<SendIcon size={22} color={Colors.textPrimary} />}
          onPress={() => {
            router.push("/send");
          }}
        />

        <QuickAction
          label="Receive"
          icon={<ReceiveIcon size={22} color={Colors.textPrimary} />}
          onPress={() => {
            router.push("/receive");
          }}
        />

        <QuickAction
          label="Swap"
          icon={<SwapIcon size={22} color={Colors.textPrimary} />}
          onPress={() => {
            router.push("/swap");
          }}
        />
      </View>

      <AppText variant="heading" style={styles.assetsHeading}>
        Assets
      </AppText>

      {error && (
        <AppText variant="caption" tone="danger">
          {error}
        </AppText>
      )}

      {!portfolio && !error && (
        <ActivityIndicator
          color={Colors.textSecondary}
          style={styles.assetsSpinner}
        />
      )}

      <View>
        {portfolio?.assets.map((asset, index) => {
          const assetId =
            asset.type === "native" ? "native" : asset.contractAddress;

          return (
            <View
              key={asset.contractAddress ?? `${asset.type}-${asset.symbol}`}
              style={index > 0 ? styles.assetDivider : undefined}
            >
              <AssetRow
                asset={asset}
                changePercent={change?.byAsset[assetKey(asset)] ?? null}
                onPress={
                  assetId
                    ? () => {
                        router.push({
                          pathname: "/asset/[id]",

                          params: {
                            id: assetId,
                          },
                        });
                      }
                    : undefined
                }
              />
            </View>
          );
        })}
      </View>

      <View style={styles.listFooter} />
    </Screen>
  );
}
