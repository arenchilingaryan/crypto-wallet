import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, View } from "react-native";

import { AddressPill } from "@/components/address-pill";
import { AssetRow } from "@/components/asset-row";
import { Screen } from "@/components/ui/screen";
import { AppText } from "@/components/ui/text";
import { Colors } from "@/constants/theme";
import type { Portfolio } from "@/core/blockchain/getPortfolio";
import { formatUsd } from "@/utils/format";
import * as Clipboard from "expo-clipboard";

import { styles } from "./home-view.styles";

import { useState } from "react";
import type { Address } from "viem";

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
      <View style={styles.header}>
        <View>
          <AppText variant="caption" tone="muted">
            Network
          </AppText>

          <AppText variant="bodyStrong">
            {portfolio?.network ?? "Connecting…"}
          </AppText>
        </View>

        <AddressPill
          address={address}
          onPress={() => {
            router.push("/wallets");
          }}
        />
        <View style={styles.addressActions}>
          <AddressPill
            address={address}
            onPress={() => {
              router.push("/wallets");
            }}
          />

          <Pressable
            onPress={() => {
              void copyAddress();
            }}
            style={({ pressed }) => [
              styles.copyButton,
              pressed && styles.pressed,
            ]}
          >
            <AppText variant="caption" tone="secondary">
              {addressCopied ? "Copied" : "Copy"}
            </AppText>
          </Pressable>
        </View>
      </View>

      <View style={styles.balance}>
        <AppText variant="overline" tone="muted">
          Total balance
        </AppText>

        <AppText variant="display" tone="paper" tabular>
          {portfolio ? formatUsd(portfolio.totalUsd) : "—"}
        </AppText>
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
