import { useEffect, useRef, useState } from "react";

import { ActivityIndicator } from "react-native";

import { useRouter } from "expo-router";

import { formatEther, getAddress, isAddress, type Hash } from "viem";

import { PinView } from "@/components/screens/pin-view";
import { SendNativeView } from "@/components/screens/send-native-view";
import { SendPreviewView } from "@/components/screens/send-preview-view";
import {
  SendStatusView,
  type SendStatus,
} from "@/components/screens/send-status-view";
import { Screen } from "@/components/ui/screen";

import { ACTIVE_NETWORK } from "@/constants/networks";
import { Colors } from "@/constants/theme";

import { createNativeTransferPreview } from "@/core/transactions/createNativeTransferPreview";
import {
  normalizeEthAmountInput,
  parseEthAmountInput,
} from "@/core/transactions/ethAmountInput";
import type { PreparedNativeTransfer } from "@/core/transactions/nativeTransfer";

import { securityApi } from "@/platform/react-native/securityApi";
import { signerApi } from "@/platform/react-native/signerApi";
import { trackedTransactionApi } from "@/platform/react-native/trackedTransactionApi";
import {
  transactionApi,
  type NativeTransferQuote,
} from "@/platform/react-native/transactionApi";

export default function SendNativeScreen() {
  const router = useRouter();

  const [to, setTo] = useState("");

  const [amount, setAmount] = useState("");

  const [error, setError] = useState<string | null>(null);

  const [inputError, setInputError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);

  const [quoteLoading, setQuoteLoading] = useState(false);

  const [quote, setQuote] = useState<NativeTransferQuote | null>(null);

  const [transaction, setTransaction] = useState<PreparedNativeTransfer | null>(
    null,
  );

  const [sendStatus, setSendStatus] = useState<SendStatus | null>(null);

  const [transactionHash, setTransactionHash] = useState<Hash | null>(null);

  const [reauthing, setReauthing] = useState(false);

  // null = ещё не знаем; false = PIN не настроен, перед отправкой создаём.
  const [pinConfigured, setPinConfigured] = useState<boolean | null>(null);

  const quoteRequestId = useRef(0);

  useEffect(() => {
    void securityApi.hasPin().then(setPinConfigured);
  }, []);

  useEffect(() => {
    setQuote(null);

    const recipient = to.trim();

    const value = parseEthAmountInput(amount);

    if (!amount) {
      setInputError(null);
      setQuoteLoading(false);

      return;
    }

    if (!value) {
      if (amount.endsWith(".")) {
        setInputError(null);
      } else {
        setInputError("Enter a valid ETH amount");
      }

      setQuoteLoading(false);

      return;
    }

    if (!recipient) {
      setInputError(null);
      setQuoteLoading(false);

      return;
    }

    if (
      !isAddress(recipient, {
        strict: false,
      })
    ) {
      setInputError("Invalid recipient address");

      setQuoteLoading(false);

      return;
    }

    setInputError(null);
    setQuoteLoading(true);

    const requestId = ++quoteRequestId.current;

    const timer = setTimeout(() => {
      void transactionApi
        .quoteNativeTransfer({
          to: getAddress(recipient),

          value,
        })
        .then((result) => {
          if (requestId !== quoteRequestId.current) {
            return;
          }

          setQuote(result);

          if (!result.hasSufficientBalance) {
            setInputError("Insufficient balance");

            return;
          }

          setInputError(null);
        })
        .catch((quoteError) => {
          if (requestId !== quoteRequestId.current) {
            return;
          }

          console.error("Fee quote failed:", quoteError);

          setQuote(null);

          setInputError("Failed to estimate network fee");
        })
        .finally(() => {
          if (requestId === quoteRequestId.current) {
            setQuoteLoading(false);
          }
        });
    }, 400);

    return () => {
      clearTimeout(timer);

      quoteRequestId.current++;
    };
  }, [to, amount]);
  const canContinue =
    !loading &&
    !quoteLoading &&
    !inputError &&
    quote !== null &&
    quote.hasSufficientBalance;

  async function handleContinue() {
    if (!canContinue || !quote) {
      return;
    }

    const recipient = to.trim();

    const value = parseEthAmountInput(amount);

    if (
      !value ||
      !isAddress(recipient, {
        strict: false,
      })
    ) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const prepared = await transactionApi.prepareNativeTransfer({
        to: getAddress(recipient),

        value,
      });

      setTransaction(prepared);
    } catch (prepareError) {
      console.error("Transaction preparation failed:", prepareError);

      setError(
        prepareError instanceof Error
          ? prepareError.message
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
        networkName={ACTIVE_NETWORK.name}
        onDone={() => {
          router.replace("/");
        }}
      />
    );
  }

  async function authorizeAndSend(pin: string): Promise<string | null> {
    if (!transaction) {
      return "Transaction is missing";
    }

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
    } catch (authorizationError) {
      console.error("Transaction authorization failed:", authorizationError);

      return authorizationError instanceof Error
        ? authorizationError.message
        : "Failed to authorize transaction";
    }

    try {
      const signed = await signerApi.signNativeTransfer(
        transaction,
        authorization,
      );

      setReauthing(false);

      setSendStatus("broadcasting");

      const hash = await transactionApi.broadcastSignedTransaction(signed);

      setTransactionHash(hash);

      await trackedTransactionApi.trackNativeTransfer(transaction, hash);

      setSendStatus("pending");
      try {
        const receipt = await transactionApi.waitForTransactionReceipt(hash);

        setSendStatus(
          receipt.status === "success" ? "confirmed" : "reverted",
        );
      } catch (receiptError) {
        console.error("Receipt tracking failed:", receiptError);

        setSendStatus("submitted");
      }

      return null;
    } catch (submissionError) {
      console.error("Transaction submission failed:", submissionError);

      setSendStatus(null);

      setReauthing(true);

      return submissionError instanceof Error
        ? submissionError.message
        : "Failed to send transaction";
    }
  }

  if (transaction && reauthing) {
    if (pinConfigured === null) {
      return (
        <Screen
          style={{
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ActivityIndicator color={Colors.textSecondary} />
        </Screen>
      );
    }

    // Кошельки, созданные до PIN-фичи: перед первой отправкой создаём PIN
    // и тем же вводом авторизуем транзакцию.
    if (!pinConfigured) {
      return (
        <PinView
          // key: см. change-pin — setup и reauth не должны делить инстанс.
          key="send-setup"
          mode="setup"
          onCancel={() => {
            setReauthing(false);
          }}
          onSubmit={async (pin) => {
            try {
              await securityApi.setupPin(pin);
            } catch (setupError) {
              console.error("PIN setup failed:", setupError);

              return "Failed to create PIN";
            }

            setPinConfigured(true);

            return authorizeAndSend(pin);
          }}
        />
      );
    }

    return (
      <PinView
        key="send-reauth"
        mode="reauth"
        onCancel={() => {
          setReauthing(false);
        }}
        onSubmit={authorizeAndSend}
      />
    );
  }

  if (transaction) {
    const preview = createNativeTransferPreview(
      transaction,
      ACTIVE_NETWORK.name,
    );

    return (
      <SendPreviewView
        preview={preview}
        onBack={() => {
          setTransaction(null);
          setTransactionHash(null);
          setSendStatus(null);
          setReauthing(false);
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
      error={inputError ?? error}
      loading={loading}
      quoteLoading={quoteLoading}
      canContinue={canContinue}
      balanceEth={quote ? formatEther(quote.balanceWei) : null}
      networkFeeEth={
        quote && quote.maximumNetworkFeeWei > 0n
          ? formatEther(quote.maximumNetworkFeeWei)
          : null
      }
      totalEth={quote ? formatEther(quote.maximumTotalWei) : null}
      onChangeTo={(value) => {
        setTo(value);

        setError(null);
      }}
      onChangeAmount={(value) => {
        const normalized = normalizeEthAmountInput(value);

        if (normalized === null) {
          return;
        }

        setAmount(normalized);

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
