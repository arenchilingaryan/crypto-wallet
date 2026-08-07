import { useEffect, useState } from "react";
import { ActivityIndicator, Button, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getEthBalance } from "../core/blockchain/getEthBalance";
import { walletApi } from "../platform/react-native/walletApi";

import type { Address } from "viem";

type WalletState =
  | { status: "loading" }
  | { status: "empty" }
  | {
      status: "generated";
      address: Address;
      mnemonic: string;
    }
  | {
      status: "confirming";
      address: Address;
      mnemonic: string;
    }
  | {
      status: "ready";
      address: Address;
    };

export default function Index() {
  const [walletState, setWalletState] = useState<WalletState>({
    status: "loading",
  });

  const [word3, setWord3] = useState("");
  const [word7, setWord7] = useState("");
  const [word11, setWord11] = useState("");
  const [confirmationError, setConfirmationError] = useState<string | null>(
    null,
  );
  const [balance, setBalance] = useState<string | null>(null);

  useEffect(() => {
    bootstrap();
  }, []);

  useEffect(() => {
    if (walletState.status !== "ready") {
      return;
    }

    getEthBalance(walletState.address)
      .then((result) => {
        setBalance(result.formatted);
      })
      .catch((error) => {
        console.error("Balance load failed:", error);
      });
  }, [walletState]);

  async function bootstrap() {
    try {
      const wallet = await walletApi.load();

      if (!wallet) {
        setWalletState({
          status: "empty",
        });

        return;
      }

      setWalletState({
        status: "ready",
        address: wallet.address,
      });
    } catch (error) {
      console.error("Wallet bootstrap failed:", error);
    }
  }

  async function handleGenerateWallet() {
    try {
      const wallet = await walletApi.generate();

      setWalletState({
        status: "generated",
        address: wallet.address,
        mnemonic: wallet.mnemonic,
      });
    } catch (error) {
      console.error("Wallet generation failed:", error);
    }
  }

  async function handleConfirmMnemonic() {
    if (walletState.status !== "confirming") {
      return;
    }

    const valid = walletApi.confirmMnemonic(walletState.mnemonic, [
      {
        index: 2,
        word: word3,
      },
      {
        index: 6,
        word: word7,
      },
      {
        index: 10,
        word: word11,
      },
    ]);

    if (!valid) {
      setConfirmationError("Words do not match");
      return;
    }

    await walletApi.persist(walletState.mnemonic);

    setWalletState({
      status: "ready",
      address: walletState.address,
    });
  }

  if (walletState.status === "loading") {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (walletState.status === "empty") {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View>
          <Text>No wallet</Text>

          <Button title="Create wallet" onPress={handleGenerateWallet} />
        </View>
      </SafeAreaView>
    );
  }

  if (walletState.status === "generated") {
    const words = walletState.mnemonic.split(" ");

    return (
      <SafeAreaView
        style={{
          flex: 1,
          padding: 24,
        }}
      >
        <View>
          <Text>Recovery phrase</Text>

          {words.map((word, index) => (
            <Text key={`${word}-${index}`}>
              {index + 1}. {word}
            </Text>
          ))}

          <Button
            title="I've saved it"
            onPress={() => {
              setWalletState({
                status: "confirming",
                address: walletState.address,
                mnemonic: walletState.mnemonic,
              });
            }}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (walletState.status === "confirming") {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          padding: 24,
        }}
      >
        <View>
          <Text>Confirm recovery phrase</Text>

          <Text>Word #3</Text>

          <TextInput
            value={word3}
            onChangeText={setWord3}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text>Word #7</Text>

          <TextInput
            value={word7}
            onChangeText={setWord7}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text>Word #11</Text>

          <TextInput
            value={word11}
            onChangeText={setWord11}
            autoCapitalize="none"
            autoCorrect={false}
          />

          {confirmationError && <Text>{confirmationError}</Text>}

          <Button title="Confirm" onPress={handleConfirmMnemonic} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={{
        flex: 1,
        padding: 24,
      }}
    >
      <View>
        <Text>Wallet</Text>
        <Text>Balance: {balance ?? "Loading..."} ETH</Text>

        <Text selectable>{walletState.address}</Text>
      </View>
    </SafeAreaView>
  );
}
