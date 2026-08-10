import { useState } from "react";

import { useRouter } from "expo-router";

import { ActivityIndicator, Pressable, View } from "react-native";

import * as Clipboard from "expo-clipboard";

import type { Address } from "viem";

import { AddressPill } from "@/components/address-pill";
import { AssetRow } from "@/components/asset-row";

import { CopyIcon } from "@/components/icons/copy-icon";
import { SearchIcon } from "@/components/icons/search-icon";

import { Screen } from "@/components/ui/screen";
import { AppText } from "@/components/ui/text";

import { Colors } from "@/constants/theme";

import type { Portfolio } from "@/core/blockchain/getPortfolio";

import { formatUsd } from "@/utils/format";

import { ReceiveIcon } from "@/components/icons/receive-icon";

import { styles } from "./home-view.styles";

type HomeViewProps = {
  address: Address;

  portfolio: Portfolio | null;

  error: string | null;
};

export function HomeView({ address, portfolio, error }: HomeViewProps) {
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
    <Screen>
      {/* TOP HEADER */}
      <View style={styles.topRow}>
        <View style={styles.network}>
          <AppText variant="overline" tone="muted">
            Network
          </AppText>

          <AppText variant="bodyStrong">
            {portfolio?.network ?? "Connecting…"}
          </AppText>
        </View>

        {/* SEARCH — TOP RIGHT */}
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
          <SearchIcon size={21} color={Colors.textPrimary} />
        </Pressable>
      </View>

      {/* WALLET ADDRESS */}
      <View style={styles.addressActions}>
        <AddressPill
          address={address}
          onPress={() => {
            router.push("/wallets");
          }}
        />

        {/* COPY ICON */}
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
            size={19}
            color={addressCopied ? Colors.textSecondary : Colors.textPrimary}
          />
        </Pressable>
      </View>

      {/* COPY FEEDBACK */}
      {addressCopied && (
        <AppText variant="caption" tone="muted" style={styles.copyFeedback}>
          Address copied
        </AppText>
      )}

      {/* BALANCE */}
      <View style={styles.balance}>
        <AppText variant="overline" tone="muted">
          Total balance
        </AppText>

        <AppText variant="display" tone="paper" tabular>
          {portfolio ? formatUsd(portfolio.totalUsd) : "—"}
        </AppText>
      </View>

      <View style={styles.walletActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Receive assets"
          onPress={() => {
            router.push("/receive");
          }}
          style={({ pressed }) => [
            styles.walletAction,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.walletActionIcon}>
            <ReceiveIcon size={21} color={Colors.textPrimary} />
          </View>

          <AppText variant="label">Receive</AppText>
        </Pressable>
      </View>

      {/* ASSETS */}
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
    </Screen>
  );
}
