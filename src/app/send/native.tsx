import { useState } from "react";

import { getAddress, isAddress, parseEther } from "viem";

import { useRouter } from "expo-router";

import { SendNativeView } from "@/components/screens/send-native-view";
import { SendPreviewView } from "@/components/screens/send-preview-view";

import { createNativeTransferPreview } from "@/core/transactions/createNativeTransferPreview";

import type { PreparedNativeTransfer } from "@/core/transactions/nativeTransfer";

import { transactionApi } from "@/platform/react-native/transactionApi";

import type { Hash } from "viem";

import {
    SendStatusView,
    type SendStatus,
} from "@/components/screens/send-status-view";

import { PinView } from "@/components/screens/pin-view";
import { securityApi } from "@/platform/react-native/securityApi";
import { signerApi } from "@/platform/react-native/signerApi";

export default function SendNativeScreen() {
  const router = useRouter();

  const [to, setTo] = useState("");

  const [amount, setAmount] = useState("");

  const [error, setError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);

  const [transaction, setTransaction] = useState<PreparedNativeTransfer | null>(
    null,
  );

  const [sendStatus, setSendStatus] = useState<SendStatus | null>(null);

  const [transactionHash, setTransactionHash] = useState<Hash | null>(null);

  const [reauthing, setReauthing] = useState(false);

  async function handleContinue() {
    try {
      setError(null);

      const recipient = to.trim();

      if (
        !isAddress(recipient, {
          strict: false,
        })
      ) {
        setError("Invalid recipient address");

        return;
      }

      let value: bigint;

      try {
        value = parseEther(amount.trim());
      } catch {
        setError("Invalid ETH amount");

        return;
      }

      if (value <= 0n) {
        setError("Amount must be greater than zero");

        return;
      }

      setLoading(true);

      const prepared = await transactionApi.prepareNativeTransfer({
        to: getAddress(recipient),

        value,
      });

      setTransaction(prepared);
    } catch (error) {
      console.error("Transaction preparation failed:", error);

      setError(
        error instanceof Error
          ? error.message
          : "Failed to prepare transaction",
      );
    } finally {
      setLoading(false);
    }
  }

  if (transaction && sendStatus) {
    return (
      <SendStatusView
        status={sendStatus}
        hash={transactionHash}
        onDone={() => {
          router.replace("/");
        }}
      />
    );
  }

  if (transaction && reauthing) {
    return (
      <PinView
        mode="reauth"
        onSubmit={async (pin) => {
          let authorization: string;

          try {
            const result = await securityApi.reauthorizeTransaction(
              pin,
              transaction,
            );

            if (!result.ok) {
              if (result.reason === "locked") {
                return `Too many attempts. Try again in ${Math.ceil(
                  result.retryAfterMs / 1000,
                )}s.`;
              }

              return `Wrong PIN. ${result.attemptsLeft} attempts left.`;
            }

            authorization = result.authorization;
          } catch (error) {
            console.error("Transaction authorization failed:", error);

            return error instanceof Error
              ? error.message
              : "Failed to authorize transaction";
          }

          try {
            const signed = await signerApi.signNativeTransfer(
              transaction,
              authorization,
            );

            setReauthing(false);
            setSendStatus("broadcasting");

            const hash =
              await transactionApi.broadcastSignedTransaction(signed);

            setTransactionHash(hash);
            setSendStatus("pending");

            try {
              const receipt =
                await transactionApi.waitForTransactionReceipt(hash);

              setSendStatus(
                receipt.status === "success" ? "confirmed" : "reverted",
              );
            } catch (error) {
              console.error("Receipt tracking failed:", error);

              setSendStatus("submitted");
            }

            return null;
          } catch (error) {
            console.error("Transaction submission failed:", error);

            setSendStatus(null);
            setReauthing(true);

            return error instanceof Error
              ? error.message
              : "Failed to send transaction";
          }
        }}
      />
    );
  }

  if (transaction) {
    const preview = createNativeTransferPreview(
      transaction,
      "Ethereum Sepolia",
    );

    return (
      <SendPreviewView
        preview={preview}
        onBack={() => {
          setTransaction(null);
        }}
        onConfirm={() => {
          setReauthing(true);
        }}
      />
    );
  }

  return (
    <SendNativeView
      to={to}
      amount={amount}
      error={error}
      loading={loading}
      onChangeTo={(value) => {
        setTo(value);
        setError(null);
      }}
      onChangeAmount={(value) => {
        setAmount(value);
        setError(null);
      }}
      onContinue={() => {
        void handleContinue();
      }}
      onBack={() => {
        router.back();
      }}
    />
  );
}
