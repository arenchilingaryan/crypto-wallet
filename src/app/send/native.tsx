import { useEffect, useRef, useState } from "react";

import { ActivityIndicator } from "react-native";

import { useRouter } from "expo-router";

import {
  formatEther,
  getAddress,
  isAddress,
  keccak256,
  type Hash,
} from "viem";

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

import { foldPolicyDecision } from "@/core/security/policyDecision";
import type { SecurityReview } from "@/core/security/securityReview";
import type { RecipientIntelligence } from "@/core/security/recipientIntelligence";

import { policyApi } from "@/platform/react-native/policyApi";
import { recipientApi } from "@/platform/react-native/recipientApi";
import { describePinFailure } from "@/core/security/pin";

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

  const [pinConfigured, setPinConfigured] = useState<boolean | null>(null);

  const [amountUsd, setAmountUsd] = useState<number | null>(null);

  const [review, setReview] = useState<SecurityReview | null>(null);

  const [recipientIntel, setRecipientIntel] =
    useState<RecipientIntelligence | null>(null);

  const quoteRequestId = useRef(0);

  useEffect(() => {
    void securityApi.hasPin().then(setPinConfigured);
  }, []);

  useEffect(() => {
    setQuote(null);

    setReview(null);

    setRecipientIntel(null);

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
    review?.decision.decision !== "block" &&
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

      const [verdict, intel] = await Promise.all([
        policyApi.check({
          recipient: getAddress(recipient),

          symbol: ACTIVE_NETWORK.nativeSymbol,

          amount,
        }),

        recipientApi.analyze(getAddress(recipient)).catch((intelError) => {
          console.error("Recipient analysis failed:", intelError);

          // Fail honest, not silent: an unchecked recipient is surfaced as
          // "unknown", never as an absent (implicitly fine) panel.
          return {
            identity: "unknown" as const,
            historyCoverage: "unavailable" as const,
            lookalike: null,
          };
        }),
      ]);

      setReview(verdict.review);

      setRecipientIntel(intel);

      const blocked = foldPolicyDecision(verdict.review.decision, {
        allow: () => null,

        uncovered: () => null,

        block: (decision) => decision.message,
      });

      if (blocked !== null) {
        return;
      }

      setAmountUsd(verdict.amountUsd);

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

    let reservationId: string | null = null;

    try {
      const result = await securityApi.reauthorizeTransaction(
        pin,
        transaction,
        { amountUsd },
      );

      if (!result.ok) {
        return result.reason === "outflow-reserved"
          ? result.message
          : describePinFailure(result);
      }

      authorization = result.authorization;

      reservationId = result.reservationId;
    } catch (authorizationError) {
      console.error("Transaction authorization failed:", authorizationError);

      return authorizationError instanceof Error
        ? authorizationError.message
        : "Failed to authorize transaction";
    }

    let recorded = false;

    try {
      const signed = await signerApi.signNativeTransfer(
        transaction,
        authorization,
      );

      setReauthing(false);

      setSendStatus("broadcasting");

      const expectedHash = keccak256(signed);

      await trackedTransactionApi.trackNativeTransfer(
        transaction,
        expectedHash,
        amountUsd,
        "broadcast-pending",
        signed,
      );

      recorded = true;

      await securityApi.releaseOutflow(reservationId);

      setTransactionHash(expectedHash);

      const hash = await transactionApi
        .broadcastSignedTransaction(signed)
        .catch(async (broadcastError: unknown) => {
          await trackedTransactionApi.markBroadcastResult(
            expectedHash,
            "broadcast-unknown",
          );

          throw broadcastError;
        });

      await trackedTransactionApi.markBroadcastResult(expectedHash, "pending");

      if (amountUsd === null) {
        void trackedTransactionApi.backfillValueUsd(
          hash,
          ACTIVE_NETWORK.nativeSymbol,
          amount,
        );
      }

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

      if (!recorded) {
        await securityApi.releaseOutflow(reservationId);
      }

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

    if (!pinConfigured) {
      return (
        <PinView

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
        review={review}
        recipientIntelligence={recipientIntel}
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
      review={review}
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
