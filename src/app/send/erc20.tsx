import { useEffect, useRef, useState } from "react";

import { ActivityIndicator } from "react-native";

import { useLocalSearchParams, useRouter } from "expo-router";

import { goBack } from "@/utils/navigation";

import {
  formatUnits,
  getAddress,
  isAddress,
  keccak256,
  type Address,
  type Hash,
} from "viem";

import { PinView } from "@/components/screens/pin-view";
import type { SecurityReview } from "@/core/security/securityReview";
import { SendErc20View } from "@/components/screens/send-erc20-view";
import { SendPreviewView } from "@/components/screens/send-preview-view";
import {
  SendStatusView,
  type SendStatus,
} from "@/components/screens/send-status-view";
import { AppText } from "@/components/ui/text";
import { Screen } from "@/components/ui/screen";

import { ACTIVE_NETWORK } from "@/constants/networks";
import { Colors } from "@/constants/theme";

import { getTokenMetadata } from "@/core/blockchain/getTokenMetadata";
import { createErc20TransferPreview } from "@/core/transactions/createErc20TransferPreview";
import type { PreparedErc20Transfer } from "@/core/transactions/erc20Transfer";
import {
  normalizeTokenAmountInput,
  parseTokenAmountInput,
} from "@/core/transactions/tokenAmountInput";

import { foldPolicyDecision } from "@/core/security/policyDecision";
import type { RecipientIntelligence } from "@/core/security/recipientIntelligence";

import { policyApi } from "@/platform/react-native/policyApi";
import { recipientApi } from "@/platform/react-native/recipientApi";
import { describePinFailure } from "@/core/security/pin";

import { securityApi } from "@/platform/react-native/securityApi";
import { signerApi } from "@/platform/react-native/signerApi";
import { trackedTransactionApi } from "@/platform/react-native/trackedTransactionApi";
import {
  transactionApi,
  type Erc20TransferQuote,
} from "@/platform/react-native/transactionApi";

type TokenState = {
  address: Address;

  symbol: string;

  name: string;

  decimals: number;

  balance: bigint;
};

export default function SendErc20Screen() {
  const router = useRouter();

  const { contract } = useLocalSearchParams<{
    contract?: string;
  }>();

  const [token, setToken] = useState<TokenState | null>(null);

  const [tokenError, setTokenError] = useState<string | null>(null);

  const [to, setTo] = useState("");

  const [amount, setAmount] = useState("");

  const [error, setError] = useState<string | null>(null);

  const [inputError, setInputError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);

  const [quoteLoading, setQuoteLoading] = useState(false);

  const [quote, setQuote] = useState<Erc20TransferQuote | null>(null);

  const [transaction, setTransaction] = useState<PreparedErc20Transfer | null>(
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
    let mounted = true;

    if (
      !contract ||
      !isAddress(contract, {
        strict: false,
      })
    ) {
      setTokenError("Token contract is missing");

      return;
    }

    const tokenAddress = getAddress(contract);

    void (async () => {
      try {
        setTokenError(null);

        const [metadata, balance] = await Promise.all([
          getTokenMetadata(tokenAddress),

          transactionApi.getErc20Balance(tokenAddress),
        ]);

        if (!mounted) {
          return;
        }

        if (!metadata) {
          setTokenError("Token metadata not found");

          return;
        }

        setToken({
          address: tokenAddress,

          symbol: metadata.symbol,

          name: metadata.name,

          decimals: metadata.decimals,

          balance,
        });
      } catch (loadError) {
        console.error("Token state loading failed:", loadError);

        if (!mounted) {
          return;
        }

        setTokenError("Failed to load token");
      }
    })();

    return () => {
      mounted = false;
    };
  }, [contract]);

  useEffect(() => {
    setQuote(null);

    setReview(null);

    setRecipientIntel(null);

    if (!token) {
      return;
    }

    const recipient = to.trim();

    const value = parseTokenAmountInput(amount, token.decimals);

    if (!amount) {
      setInputError(null);
      setQuoteLoading(false);

      return;
    }

    if (!value) {
      if (amount.endsWith(".")) {
        setInputError(null);
      } else {
        setInputError(`Enter a valid ${token.symbol} amount`);
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
        .quoteErc20Transfer({
          token: token.address,

          to: getAddress(recipient),

          amount: value,
        })
        .then((result) => {
          if (requestId !== quoteRequestId.current) {
            return;
          }

          setQuote(result);

          if (!result.hasSufficientTokenBalance) {
            setInputError(`Insufficient ${token.symbol} balance`);

            return;
          }

          if (!result.hasSufficientEthForFee) {
            setInputError("Insufficient ETH for the network fee");

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
  }, [token, to, amount]);

  const canContinue =
    review?.decision.decision !== "block" &&
    !loading &&
    !quoteLoading &&
    !inputError &&
    quote !== null &&
    quote.hasSufficientTokenBalance &&
    quote.hasSufficientEthForFee;

  async function handleContinue() {
    if (!canContinue || !quote || !token) {
      return;
    }

    const recipient = to.trim();

    const value = parseTokenAmountInput(amount, token.decimals);

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

          symbol: token.symbol,

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

      const prepared = await transactionApi.prepareErc20Transfer({
        token: token.address,

        to: getAddress(recipient),

        amount: value,

        tokenSymbol: token.symbol,

        tokenDecimals: token.decimals,

        // Bound to the wallet the review above was about; a switch in between
        // refuses preparation instead of reusing another wallet's review.
        expectedWallet: verdict.wallet,
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
      const signed = await signerApi.signErc20Transfer(
        transaction,
        authorization,
      );

      setReauthing(false);

      setSendStatus("broadcasting");

      const expectedHash = keccak256(signed);

      await trackedTransactionApi.trackErc20Transfer(
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

      if (amountUsd === null && token) {
        void trackedTransactionApi.backfillValueUsd(hash, token.symbol, amount);
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

  if (tokenError) {
    return (
      <Screen
        onBack={() => {
          goBack("/send");
        }}
      >
        <AppText variant="bodyStrong" tone="danger">
          {tokenError}
        </AppText>
      </Screen>
    );
  }

  if (!token) {
    return (
      <Screen
        onBack={() => {
          goBack("/send");
        }}
        style={{
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={Colors.textSecondary} />
      </Screen>
    );
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

          key="send-erc20-setup"
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
        key="send-erc20-reauth"
        mode="reauth"
        onCancel={() => {
          setReauthing(false);
        }}
        onSubmit={authorizeAndSend}
      />
    );
  }

  if (transaction) {
    const preview = createErc20TransferPreview(
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
    <SendErc20View
      symbol={token.symbol}
      to={to}
      amount={amount}
      review={review}
      error={inputError ?? error}
      loading={loading}
      onChangeTo={(value) => {
        setTo(value);
        setError(null);
      }}
      onChangeAmount={(value) => {
        const normalized = normalizeTokenAmountInput(value, token.decimals);

        if (normalized === null) {
          return;
        }

        setAmount(normalized);
        setError(null);
      }}
      onContinue={handleContinue}
      onBack={() => {
        goBack("/send");
      }}
      balanceToken={formatUnits(token.balance, token.decimals)}
      networkFeeEth={
        quote && quote.gas > 0n
          ? formatUnits(quote.maximumNetworkFeeWei, 18)
          : null
      }
      quoteLoading={quoteLoading}
      canContinue={canContinue}
    />
  );
}
