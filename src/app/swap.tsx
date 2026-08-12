import { useEffect, useRef, useState } from "react";

import { router, useLocalSearchParams } from "expo-router";

import { formatUnits, getAddress, isAddress, type Hash } from "viem";

import { AssetPickerView } from "@/components/screens/asset-picker-view";
import { PinView } from "@/components/screens/pin-view";
import {
  SendStatusView,
  type SendStatus,
} from "@/components/screens/send-status-view";
import { SwapPreviewView } from "@/components/screens/swap-preview-view";
import { SwapView, type SwapSide } from "@/components/screens/swap-view";

import { ACTIVE_NETWORK } from "@/constants/networks";

import type { AssetSearchResult } from "@/core/blockchain/assetSearch";
import { getPortfolio, type Portfolio } from "@/core/blockchain/getPortfolio";
import { getTokenMetadata } from "@/core/blockchain/getTokenMetadata";
import { searchAssets } from "@/core/blockchain/searchAssets";
import {
  createSwapApprovePreview,
  createSwapPreview,
} from "@/core/transactions/createSwapPreview";
import type { PreparedErc20Approve } from "@/core/transactions/erc20Approve";
import type { PreparedSwap, SwapAssetRef } from "@/core/transactions/swap";
import {
  normalizeTokenAmountInput,
  parseTokenAmountInput,
} from "@/core/transactions/tokenAmountInput";

import { securityApi } from "@/platform/react-native/securityApi";
import { signerApi } from "@/platform/react-native/signerApi";
import { trackedTransactionApi } from "@/platform/react-native/trackedTransactionApi";
import {
  transactionApi,
  type SwapQuote,
} from "@/platform/react-native/transactionApi";
import { walletApi } from "@/platform/react-native/walletApi";

// Выбранная сторона обмена: роутинговая ссылка + всё для отображения.
type SelectedAsset = {
  ref: SwapAssetRef;

  name: string;

  logo: string | null;
};

type PickerTarget = "pay" | "receive" | null;

// Какую транзакцию сейчас ведём через PIN/статус: разрешение или сам своп.
type SubmitPhase =
  | { kind: "approve"; transaction: PreparedErc20Approve }
  | { kind: "swap"; transaction: PreparedSwap };

const NATIVE_ETH: SelectedAsset = {
  ref: {
    address: null,

    symbol: ACTIVE_NETWORK.nativeSymbol,

    decimals: 18,
  },

  name: "Ethereum",

  logo: null,
};

function sameAsset(a: SwapAssetRef, b: SwapAssetRef) {
  const left = a.address?.toLowerCase() ?? "native";

  const right = b.address?.toLowerCase() ?? "native";

  return left === right;
}

// Монета из параметра маршрута: сперва портфель (там есть логотип и имя),
// затем метаданные контракта.
async function resolveAsset(
  assetId: string,
  portfolio: Portfolio | null,
): Promise<SelectedAsset | null> {
  if (assetId === "native") {
    return NATIVE_ETH;
  }

  if (
    !isAddress(assetId, {
      strict: false,
    })
  ) {
    return null;
  }

  const address = getAddress(assetId);

  const fromPortfolio = portfolio?.assets.find(
    (item) =>
      item.type === "erc20" &&
      item.contractAddress?.toLowerCase() === address.toLowerCase(),
  );

  const metadata = await getTokenMetadata(address);

  if (!metadata) {
    return null;
  }

  return {
    ref: {
      address,

      symbol: metadata.symbol,

      decimals: metadata.decimals,
    },

    name: fromPortfolio?.name ?? metadata.name,

    logo: fromPortfolio?.logo ?? metadata.logo,
  };
}

function findPortfolioBalance(
  portfolio: Portfolio | null,
  asset: SwapAssetRef,
): string | null {
  if (!portfolio) {
    return null;
  }

  const match = portfolio.assets.find((item) => {
    if (asset.address === null) {
      return item.type === "native";
    }

    return (
      item.type === "erc20" &&
      item.contractAddress?.toLowerCase() === asset.address?.toLowerCase()
    );
  });

  return match?.balance ?? null;
}

export default function SwapScreen() {
  // Экран актива открывает своп уже с выбранной монетой: "native" либо
  // адрес контракта.
  const { from } = useLocalSearchParams<{ from?: string }>();

  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);

  const [payAsset, setPayAsset] = useState<SelectedAsset>(NATIVE_ETH);

  const [receiveAsset, setReceiveAsset] = useState<SelectedAsset | null>(null);

  const [amount, setAmount] = useState("");

  const [quote, setQuote] = useState<SwapQuote | null>(null);

  const [quoteLoading, setQuoteLoading] = useState(false);

  const [inputError, setInputError] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);

  // Пикер токена поверх формы.
  const [picker, setPicker] = useState<PickerTarget>(null);

  const [pickerQuery, setPickerQuery] = useState("");

  const [pickerResults, setPickerResults] = useState<AssetSearchResult[]>([]);

  const [pickerLoading, setPickerLoading] = useState(false);

  const [pickerError, setPickerError] = useState<string | null>(null);

  // Текущая подтверждаемая транзакция (превью → PIN → статус).
  const [submitPhase, setSubmitPhase] = useState<SubmitPhase | null>(null);

  const [reauthing, setReauthing] = useState(false);

  const [sendStatus, setSendStatus] = useState<SendStatus | null>(null);

  const [transactionHash, setTransactionHash] = useState<Hash | null>(null);

  const [pinConfigured, setPinConfigured] = useState<boolean | null>(null);

  // Инкремент форсирует перекотировку при том же вводе — например,
  // после подтверждённого approve, когда allowance изменился ончейн.
  const [requoteNonce, setRequoteNonce] = useState(0);

  const quoteRequestId = useRef(0);

  const pickerRequestId = useRef(0);

  useEffect(() => {
    void securityApi.hasPin().then(setPinConfigured);
  }, []);

  useEffect(() => {
    let mounted = true;

    void (async () => {
      try {
        const wallet = await walletApi.load();

        if (!wallet) {
          throw new Error("Active wallet not found");
        }

        const nextPortfolio = await getPortfolio(wallet.address);

        if (mounted) {
          setPortfolio(nextPortfolio);
        }
      } catch (bootstrapError) {
        console.error("Swap bootstrap failed:", bootstrapError);

        if (mounted) {
          setError("Failed to load wallet assets");
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // Предвыбор монеты из параметра маршрута. Таб живёт постоянно, поэтому
  // сбрасываем сумму и котировку — иначе к новой паре прилипнет старый ввод.
  useEffect(() => {
    if (!from) {
      return;
    }

    let mounted = true;

    void (async () => {
      const selected = await resolveAsset(from, portfolio);

      if (!mounted || !selected) {
        return;
      }

      setPayAsset(selected);

      setReceiveAsset((current) =>
        current && sameAsset(current.ref, selected.ref) ? null : current,
      );

      setAmount("");
      setQuote(null);
      setInputError(null);
      setError(null);
    })();

    return () => {
      mounted = false;
    };
  }, [from, portfolio]);

  // Котировка: перезапрашивается на каждое изменение пары/суммы,
  // с дебаунсом и отсечкой устаревших ответов — как в send/erc20.
  useEffect(() => {
    setQuote(null);

    if (!receiveAsset) {
      setInputError(null);
      setQuoteLoading(false);

      return;
    }

    if (sameAsset(payAsset.ref, receiveAsset.ref)) {
      setInputError("Cannot swap an asset for itself");
      setQuoteLoading(false);

      return;
    }

    if (!amount) {
      setInputError(null);
      setQuoteLoading(false);

      return;
    }

    const value = parseTokenAmountInput(amount, payAsset.ref.decimals);

    if (!value) {
      setInputError(
        amount.endsWith(".")
          ? null
          : `Enter a valid ${payAsset.ref.symbol} amount`,
      );

      setQuoteLoading(false);

      return;
    }

    setInputError(null);
    setQuoteLoading(true);

    const requestId = ++quoteRequestId.current;

    const timer = setTimeout(() => {
      void transactionApi
        .quoteSwap({
          assetIn: payAsset.ref,

          assetOut: receiveAsset.ref,

          amountIn: value,
        })
        .then((result) => {
          if (requestId !== quoteRequestId.current) {
            return;
          }

          setQuote(result);

          if (!result) {
            setInputError("No liquidity route found for this pair");

            return;
          }

          if (!result.hasSufficientBalance) {
            setInputError(`Insufficient ${payAsset.ref.symbol} balance`);

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

          console.error("Swap quote failed:", quoteError);

          setQuote(null);

          setInputError("Failed to fetch a swap quote");
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
  }, [payAsset, receiveAsset, amount, requoteNonce]);

  // Поиск в пикере: платёжная сторона — только активы кошелька,
  // получаемая — кошелёк плюс сеть.
  useEffect(() => {
    if (!picker || !portfolio) {
      return;
    }

    setPickerError(null);

    const currentRequest = ++pickerRequestId.current;

    const delay = pickerQuery.trim() ? 350 : 0;

    const timer = setTimeout(() => {
      setPickerLoading(true);

      void searchAssets(portfolio, pickerQuery)
        .then((results) => {
          if (currentRequest !== pickerRequestId.current) {
            return;
          }

          setPickerResults(
            picker === "pay"
              ? results.filter((item) => item.source !== "network")
              : results,
          );
        })
        .catch((searchError) => {
          if (currentRequest !== pickerRequestId.current) {
            return;
          }

          console.error("Asset search failed:", searchError);

          setPickerResults([]);

          setPickerError("Search failed");
        })
        .finally(() => {
          if (currentRequest === pickerRequestId.current) {
            setPickerLoading(false);
          }
        });
    }, delay);

    return () => {
      clearTimeout(timer);

      pickerRequestId.current++;
    };
  }, [picker, pickerQuery, portfolio]);

  async function handlePickAsset(result: AssetSearchResult) {
    try {
      let selected: SelectedAsset;

      if (result.type === "native") {
        selected = NATIVE_ETH;
      } else {
        if (!result.contractAddress) {
          return;
        }

        const address = getAddress(result.contractAddress);

        const metadata = await getTokenMetadata(address);

        if (!metadata) {
          setPickerError("Token metadata not found");

          return;
        }

        selected = {
          ref: {
            address,

            symbol: metadata.symbol,

            decimals: metadata.decimals,
          },

          name: metadata.name,

          logo: result.logo ?? metadata.logo,
        };
      }

      if (picker === "pay") {
        setPayAsset(selected);
      } else {
        setReceiveAsset(selected);
      }

      setPicker(null);

      setPickerQuery("");

      setError(null);
    } catch (pickError) {
      console.error("Asset selection failed:", pickError);

      setPickerError("Failed to load token");
    }
  }

  function handleFlip() {
    if (!receiveAsset) {
      return;
    }

    const nextPay = receiveAsset;

    setReceiveAsset(payAsset);

    setPayAsset(nextPay);

    setError(null);
  }

  const parsedAmount = parseTokenAmountInput(amount, payAsset.ref.decimals);

  const canSubmit =
    !loading &&
    !quoteLoading &&
    !inputError &&
    quote !== null &&
    quote.hasSufficientBalance &&
    quote.hasSufficientEthForFee &&
    parsedAmount !== null &&
    receiveAsset !== null;

  async function handleSubmit() {
    if (!canSubmit || !quote || !receiveAsset || !parsedAmount) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // ERC-20 на входе без разрешения: сперва approve, свопом займёмся
      // после его подтверждения.
      if (quote.needsApproval) {
        if (payAsset.ref.address === null) {
          throw new Error("Native ETH does not need an approval");
        }

        const approval = await transactionApi.prepareSwapApproval({
          token: payAsset.ref.address,

          amount: parsedAmount,

          tokenSymbol: payAsset.ref.symbol,

          tokenDecimals: payAsset.ref.decimals,
        });

        setSubmitPhase({
          kind: "approve",
          transaction: approval,
        });

        return;
      }

      const prepared = await transactionApi.prepareSwap({
        assetIn: payAsset.ref,

        assetOut: receiveAsset.ref,

        amountIn: parsedAmount,

        quotedAmountOut: quote.quotedAmountOut,

        route: quote.route,
      });

      setSubmitPhase({
        kind: "swap",
        transaction: prepared,
      });
    } catch (prepareError) {
      console.error("Swap preparation failed:", prepareError);

      setError(
        prepareError instanceof Error
          ? prepareError.message
          : "Failed to prepare the transaction",
      );
    } finally {
      setLoading(false);
    }
  }

  function resetSubmitFlow() {
    setSubmitPhase(null);
    setReauthing(false);
    setSendStatus(null);
    setTransactionHash(null);
  }

  async function authorizeAndSend(pin: string): Promise<string | null> {
    if (!submitPhase) {
      return "Transaction is missing";
    }

    let authorization: string;

    try {
      const result = await securityApi.reauthorizeTransaction(
        pin,
        submitPhase.transaction,
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
      const signed =
        submitPhase.kind === "approve"
          ? await signerApi.signErc20Approve(
              submitPhase.transaction,
              authorization,
            )
          : await signerApi.signSwap(submitPhase.transaction, authorization);

      setReauthing(false);

      setSendStatus("broadcasting");

      const hash = await transactionApi.broadcastSignedTransaction(signed);

      setTransactionHash(hash);

      if (submitPhase.kind === "approve") {
        await trackedTransactionApi.trackErc20Approve(
          submitPhase.transaction,
          hash,
        );
      } else {
        await trackedTransactionApi.trackSwap(submitPhase.transaction, hash);
      }

      setSendStatus("pending");

      try {
        const receipt = await transactionApi.waitForTransactionReceipt(hash);

        if (receipt.status !== "success") {
          setSendStatus("reverted");

          return null;
        }

        if (submitPhase.kind === "approve") {
          // Разрешение подтверждено: возвращаемся к форме и котируем
          // заново — allowance изменился, дальше кнопка поведёт в своп.
          resetSubmitFlow();

          setRequoteNonce((nonce) => nonce + 1);

          return null;
        }

        setSendStatus("confirmed");
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

  // --- Рендер фаз ---

  if (picker) {
    return (
      <AssetPickerView
        title={picker === "pay" ? "You pay" : "You receive"}
        query={pickerQuery}
        results={pickerResults}
        loading={pickerLoading}
        error={pickerError}
        onChangeQuery={setPickerQuery}
        onSelect={(asset) => {
          void handlePickAsset(asset);
        }}
        onBack={() => {
          setPicker(null);

          setPickerQuery("");
        }}
      />
    );
  }

  if (submitPhase && sendStatus) {
    return (
      <SendStatusView
        status={sendStatus}
        hash={transactionHash}
        networkName={ACTIVE_NETWORK.name}
        onDone={resetSubmitFlow}
      />
    );
  }

  if (submitPhase && reauthing) {
    if (pinConfigured === null) {
      return null;
    }

    if (!pinConfigured) {
      return (
        <PinView
          key="swap-setup"
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
        key="swap-reauth"
        mode="reauth"
        onCancel={() => {
          setReauthing(false);
        }}
        onSubmit={authorizeAndSend}
      />
    );
  }

  if (submitPhase) {
    const preview =
      submitPhase.kind === "approve"
        ? createSwapApprovePreview(submitPhase.transaction, ACTIVE_NETWORK.name)
        : createSwapPreview(submitPhase.transaction, ACTIVE_NETWORK.name);

    return (
      <SwapPreviewView
        preview={preview}
        onBack={resetSubmitFlow}
        onConfirm={() => {
          setReauthing(true);
        }}
      />
    );
  }

  const paySide: SwapSide = {
    symbol: payAsset.ref.symbol,

    name: payAsset.name,

    logo: payAsset.logo,

    type: payAsset.ref.address === null ? "native" : "erc20",

    amount,

    balance: findPortfolioBalance(portfolio, payAsset.ref),
  };

  const receiveSide: SwapSide = {
    symbol: receiveAsset?.ref.symbol ?? null,

    name: receiveAsset?.name ?? null,

    logo: receiveAsset?.logo ?? null,

    type:
      receiveAsset && receiveAsset.ref.address === null ? "native" : "erc20",

    amount:
      quote && receiveAsset
        ? formatUnits(quote.quotedAmountOut, receiveAsset.ref.decimals)
        : "—",

    balance: receiveAsset
      ? findPortfolioBalance(portfolio, receiveAsset.ref)
      : null,
  };

  const rate =
    quote && receiveAsset && parsedAmount
      ? `1 ${payAsset.ref.symbol} ≈ ${(
          Number(formatUnits(quote.quotedAmountOut, receiveAsset.ref.decimals)) /
          Number(formatUnits(parsedAmount, payAsset.ref.decimals))
        ).toLocaleString("en-US", {
          maximumSignificantDigits: 6,
        })} ${receiveAsset.ref.symbol}`
      : "—";

  const networkFee = quote
    ? `${quote.gasIsExact ? "" : "~"}${Number(
        formatUnits(quote.maximumNetworkFeeWei, 18),
      ).toLocaleString("en-US", {
        maximumSignificantDigits: 4,
      })} ETH`
    : "—";

  const route =
    quote && receiveAsset
      ? quote.route.kind === "single"
        ? `Uniswap V3 · ${quote.route.fee / 10_000}%`
        : `Uniswap V3 · via WETH`
      : undefined;

  const submitLabel = quote?.needsApproval
    ? `Approve ${payAsset.ref.symbol}`
    : "Swap";

  return (
    <SwapView
      pay={paySide}
      receive={receiveSide}
      rate={rate}
      networkFee={networkFee}
      slippage="0.5%"
      route={route}
      error={inputError ?? error}
      quoteLoading={quoteLoading}
      submitLabel={loading ? "Preparing…" : submitLabel}
      canSubmit={canSubmit}
      onChangePayAmount={(value) => {
        const normalized = normalizeTokenAmountInput(
          value,
          payAsset.ref.decimals,
        );

        if (normalized === null) {
          return;
        }

        setAmount(normalized);

        setError(null);
      }}
      onSelectPayToken={() => {
        setPicker("pay");
      }}
      onSelectReceiveToken={() => {
        setPicker("receive");
      }}
      onFlip={receiveAsset ? handleFlip : undefined}
      onSubmit={handleSubmit}
      onBack={() => {
        if (router.canGoBack()) {
          router.back();

          return;
        }

        router.replace("/");
      }}
    />
  );
}
