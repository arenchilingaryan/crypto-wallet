import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator } from "react-native";
import { getAddress, isAddress, type Address } from "viem";

import { ReceiveView } from "@/components/screens/receive-view";
import { Screen } from "@/components/ui/screen";
import { AppText } from "@/components/ui/text";

import { ACTIVE_NETWORK } from "@/constants/networks";
import { Colors } from "@/constants/theme";

import { getTokenMetadata } from "@/core/blockchain/getTokenMetadata";

import { walletApi } from "@/platform/react-native/walletApi";

type ReceiveAsset = {
  type: "native" | "erc20";
  symbol: string;
  name: string;
  contractAddress: Address | null;
};

type ReceiveState = {
  address: Address;
  asset: ReceiveAsset;
  network: string;
};

export default function ReceiveScreen() {
  const router = useRouter();

  const { id } = useLocalSearchParams<{
    id?: string;
  }>();

  const [data, setData] = useState<ReceiveState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError("Asset id is missing");
      setLoading(false);

      return;
    }

    let mounted = true;

    void loadReceiveData(id)
      .then((result) => {
        if (!mounted) {
          return;
        }

        setData(result);
      })
      .catch((loadError) => {
        console.error("Receive data loading failed:", loadError);

        if (!mounted) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load receive information",
        );
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [id]);

  async function loadReceiveData(assetId: string): Promise<ReceiveState> {
    setLoading(true);
    setError(null);

    const wallet = await walletApi.load();

    if (!wallet) {
      throw new Error("Wallet not found");
    }

    if (assetId === "native") {
      return {
        address: wallet.address,
        network: ACTIVE_NETWORK.name,
        asset: {
          type: "native",
          symbol: ACTIVE_NETWORK.nativeSymbol,
          name: "Ethereum",
          contractAddress: null,
        },
      };
    }

    if (
      !isAddress(assetId, {
        strict: false,
      })
    ) {
      throw new Error("Invalid token contract");
    }

    const contractAddress = getAddress(assetId);

    const metadata = await getTokenMetadata(contractAddress);

    if (!metadata) {
      throw new Error("Token metadata not found");
    }

    return {
      address: wallet.address,
      network: ACTIVE_NETWORK.name,
      asset: {
        type: "erc20",
        symbol: metadata.symbol,
        name: metadata.name,
        contractAddress,
      },
    };
  }

  if (loading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Receive",
          }}
        />

        <Screen
          onBack={() => {
            router.back();
          }}
          style={{
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ActivityIndicator color={Colors.textSecondary} />
        </Screen>
      </>
    );
  }

  if (!data || error) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Receive",
          }}
        />

        <Screen
          onBack={() => {
            router.back();
          }}
        >
          <AppText variant="bodyStrong" tone="danger">
            {error ?? "Asset not found"}
          </AppText>
        </Screen>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: `Receive ${data.asset.symbol}`,
        }}
      />

      <Screen
        onBack={() => {
          router.back();
        }}
      >
        <ReceiveView
          address={data.address}
          symbol={data.asset.symbol}
          assetName={data.asset.name}
          network={data.network}
          contractAddress={data.asset.contractAddress}
        />
      </Screen>
    </>
  );
}
