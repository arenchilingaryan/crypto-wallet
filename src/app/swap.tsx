import { useEffect, useRef, useState } from "react";

import { router, useLocalSearchParams } from "expo-router";

import {
  formatUnits,
  getAddress,
  isAddress,
  keccak256,
  type Hash,
} from "viem";

import { AssetPickerView } from "@/components/screens/asset-picker-view";
import { PinView } from "@/components/screens/pin-view";
import {
  SendStatusView,
  type SendStatus,
} from "@/components/screens/send-status-view";
import { SwapPreviewView } from "@/components/screens/swap-preview-view";
import { SwapView, type SwapSide } from "@/components/screens/swap-view";
import { TokenTradeBriefingView } from "@/components/token-intelligence";

import { ACTIVE_NETWORK } from "@/constants/networks";

import { getUniswapDeployment } from "@/core/blockchain/uniswap";
import { foldPolicyDecision } from "@/core/security/policyDecision";
import type { SecurityReview } from "@/core/security/securityReview";
import type { TokenIntelligence } from "@/core/token-intelligence/types";

import { policyApi } from "@/platform/react-native/policyApi";

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
  decideTradeGateForAll,
  describeTradeGate,
  requiresTradeBriefing,
  tradeTargets,
  type BriefedTrade,
} from "@/core/transactions/tradeGate";
import {
  normalizeTokenAmountInput,
  parseTokenAmountInput,
} from "@/core/transactions/tokenAmountInput";

import { describePinFailure } from "@/core/security/pin";

import { securityApi } from "@/platform/react-native/securityApi";
import { signerApi } from "@/platform/react-native/signerApi";
import {
  createUnavailableTokenIntelligence,
  isTokenIntelligenceProviderSupported,
  loadTokenIntelligence,
  unsupportedProviderReason,
} from "@/platform/react-native/token-intelligence";
import { trackedTransactionApi } from "@/platform/react-native/trackedTransactionApi";
import {
  transactionApi,
  SWAP_DEADLINE_MINUTES,
  SWAP_SLIPPAGE_BPS,
  type SwapQuote,
} from "@/platform/react-native/transactionApi";
import { walletApi } from "@/platform/react-native/walletApi";

type SelectedAsset = {
  ref: SwapAssetRef;

  name: string;

  logo: string | null;
};

type PickerTarget = "pay" | "receive" | null;

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
  const { from, to } = useLocalSearchParams<{ from?: string; to?: string }>();

  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);

  const [payAsset, setPayAsset] = useState<SelectedAsset>(NATIVE_ETH);

  const [receiveAsset, setReceiveAsset] = useState<SelectedAsset | null>(null);

  const [amount, setAmount] = useState("");

  const [quote, setQuote] = useState<SwapQuote | null>(null);

  const [quoteLoading, setQuoteLoading] = useState(false);

  const [inputError, setInputError] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  const [review, setReview] = useState<SecurityReview | null>(null);

  const [tradeBriefing, setTradeBriefing] =
    useState<TokenIntelligence | null>(null);

  const [briefingRefreshing, setBriefingRefreshing] = useState(false);

  const [briefingAsset, setBriefingAsset] = useState<SelectedAsset | null>(
    null,
  );

  const [clearedTrades, setClearedTrades] = useState<BriefedTrade[]>([]);

  const [loading, setLoading] = useState(false);

  const [picker, setPicker] = useState<PickerTarget>(null);

  const [pickerQuery, setPickerQuery] = useState("");

  const [pickerResults, setPickerResults] = useState<AssetSearchResult[]>([]);

  const [pickerLoading, setPickerLoading] = useState(false);

  // The wider token catalogue could not be consulted; results are local only.
  const [pickerCatalogueUnavailable, setPickerCatalogueUnavailable] =
    useState(false);

  const [pickerError, setPickerError] = useState<string | null>(null);

  const [submitPhase, setSubmitPhase] = useState<SubmitPhase | null>(null);

  const [reauthing, setReauthing] = useState(false);

  const [sendStatus, setSendStatus] = useState<SendStatus | null>(null);

  const [transactionHash, setTransactionHash] = useState<Hash | null>(null);

  const [pinConfigured, setPinConfigured] = useState<boolean | null>(null);

  const [requoteNonce, setRequoteNonce] = useState(0);

  const quoteRequestId = useRef(0);

  const pickerRequestId = useRef(0);

  const briefingRequestId = useRef(0);

  const initializedReceiveParam = useRef<string | null>(null);

  const latestPayAsset = useRef(payAsset);

  latestPayAsset.current = payAsset;

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

  useEffect(() => {
    if (!from || tradeBriefing || loading) {
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

  useEffect(() => {
    if (tradeBriefing || loading) {
      return;
    }

    if (!to) {
      initializedReceiveParam.current = null;
      return;
    }

    if (initializedReceiveParam.current === to) {
      return;
    }

    let mounted = true;

    void (async () => {
      try {
        const selected = await resolveAsset(to, portfolio);

        if (!mounted) {
          return;
        }

        if (!selected) {
          setError("Failed to preselect the receive token");
          return;
        }

        initializedReceiveParam.current = to;

        if (sameAsset(latestPayAsset.current.ref, selected.ref)) {
          setReceiveAsset(null);
          return;
        }

        setReceiveAsset(selected);
        setAmount("");
        setQuote(null);
        setInputError(null);
        setError(null);
      } catch (receiveAssetError) {
        console.error("Receive asset preselection failed:", receiveAssetError);

        if (mounted) {
          setError("Failed to preselect the receive token");
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [portfolio, to]);

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
              ? results.results.filter((item) => item.source !== "network")
              : results.results,
          );

          setPickerCatalogueUnavailable(results.catalogue === "unavailable");
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

  const tradeChecksCoverThisNetwork = isTokenIntelligenceProviderSupported(
    ACTIVE_NETWORK.chain.id,
    "honeypot-check",
  );

  const coverageNotice =
    tradeChecksCoverThisNetwork ||
    (payAsset.ref.address === null && receiveAsset?.ref.address == null)
      ? null
      : unsupportedProviderReason(ACTIVE_NETWORK.chain.id);

  const canSubmit =
    !loading &&
    !quoteLoading &&
    !inputError &&
    quote !== null &&
    quote.hasSufficientBalance &&
    quote.hasSufficientEthForFee &&
    parsedAmount !== null &&
    receiveAsset !== null;

  function tradeTokenIdentity(asset: SelectedAsset | null) {
    if (!asset?.ref.address) {
      return null;
    }

    return {
      chainId: ACTIVE_NETWORK.chain.id,
      address: asset.ref.address,
      symbol: asset.ref.symbol,
      name: asset.name,
    };
  }

  async function loadTradeIntelligence(
    asset: SelectedAsset | null,
    onProgress?: (intelligence: TokenIntelligence) => void,
  ) {
    const token = tradeTokenIdentity(asset);

    if (!token) {
      return null;
    }

    const { intelligence } = await loadTokenIntelligence({
      token,
      refreshTrade: true,
      onUpdate: ({ intelligence: nextIntelligence }) => {
        onProgress?.(nextIntelligence);
      },
    });

    return intelligence;
  }

  function unavailableTradeIntelligence(asset: SelectedAsset | null) {
    const token = tradeTokenIdentity(asset);

    if (!token) {
      return null;
    }

    return createUnavailableTokenIntelligence(
      token,
      "The pre-trade token check could not be completed",
    );
  }

  async function handleSubmit() {
    if (!canSubmit || !quote || !receiveAsset || !parsedAmount) {
      return;
    }

    const targets = tradeTargets({
      sold: {
        chainId: ACTIVE_NETWORK.chain.id,
        address: payAsset.ref.address,
      },
      bought: {
        chainId: ACTIVE_NETWORK.chain.id,
        address: receiveAsset.ref.address,
      },
    });

    if (targets.length === 0) {
      await prepareSubmission([]);

      return;
    }

    await runTradeChecks([]);
  }

  async function runTradeChecks(alreadyCleared: BriefedTrade[]) {
    if (!receiveAsset) {
      return;
    }

    const cleared = [...alreadyCleared];

    const assetsToCheck = [payAsset, receiveAsset].filter(
      (asset): asset is SelectedAsset =>
        asset.ref.address !== null &&
        !cleared.some(
          (entry) =>
            entry.target.address?.toLowerCase() ===
            asset.ref.address?.toLowerCase(),
        ),
    );

    for (const asset of assetsToCheck) {
      try {
        setLoading(true);
        setError(null);

        const intelligence = await loadTradeIntelligence(asset);

        if (intelligence && requiresTradeBriefing(intelligence)) {
          setBriefingRefreshing(false);
          setBriefingAsset(asset);
          setClearedTrades(cleared);
          setTradeBriefing(intelligence);

          return;
        }

        cleared.push({
          target: {
            chainId: ACTIVE_NETWORK.chain.id,
            address: asset.ref.address,
          },
          acknowledged: true,
        });
      } catch (intelligenceError) {
        console.error(
          "Pre-trade token intelligence failed:",
          intelligenceError,
        );

        const unavailable = unavailableTradeIntelligence(asset);

        if (unavailable) {
          setBriefingAsset(asset);
          setClearedTrades(cleared);
          setTradeBriefing(unavailable);
        }

        return;
      } finally {
        setLoading(false);
      }
    }

    await prepareSubmission(cleared);
  }

  async function prepareSubmission(cleared: BriefedTrade[]) {
    if (!canSubmit || !quote || !receiveAsset || !parsedAmount) {
      return;
    }

    const gate = decideTradeGateForAll({
      targets: tradeTargets({
        sold: {
          chainId: ACTIVE_NETWORK.chain.id,
          address: payAsset.ref.address,
        },
        bought: {
          chainId: ACTIVE_NETWORK.chain.id,
          address: receiveAsset.ref.address,
        },
      }),

      cleared,
    });

    if (!gate.proceed) {
      setError(describeTradeGate(gate));

      return;
    }

    try {
      setLoading(true);
      setError(null);

      if (quote.needsApproval) {
        if (payAsset.ref.address === null) {
          throw new Error("Native ETH does not need an approval");
        }

        const approvalVerdict = await policyApi.checkApproval({
          spender: getUniswapDeployment(ACTIVE_NETWORK.id)!.swapRouter02,

          token: payAsset.ref.address,

          amountRaw: parsedAmount,

          decimals: payAsset.ref.decimals,

          tokenSymbol: payAsset.ref.symbol,

          unlimited: false,
        });

        setReview(approvalVerdict);

        const approvalBlocked = foldPolicyDecision(approvalVerdict.decision, {
          allow: () => null,
          uncovered: () => null,
          block: (decision) => decision.message,
        });

        if (approvalBlocked !== null) {
          return;
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

      const swapVerdict = await policyApi.checkSwap({
        amountIn: formatUnits(parsedAmount, payAsset.ref.decimals),

        symbolIn: payAsset.ref.symbol,

        minAmountOut: formatUnits(
          quote.minAmountOut,
          receiveAsset.ref.decimals,
        ),

        symbolOut: receiveAsset.ref.symbol,

        slippagePercent: `${(SWAP_SLIPPAGE_BPS / 100).toFixed(2)}%`,

        deadlineMinutes: SWAP_DEADLINE_MINUTES,

        routerKnown: getUniswapDeployment(ACTIVE_NETWORK.id) !== null,

        routeLabel:
          quote.route.kind === "single"
            ? "Uniswap V3, direct pool"
            : "Uniswap V3, via WETH",
      });

      setReview(swapVerdict);

      const swapBlocked = foldPolicyDecision(swapVerdict.decision, {
        allow: () => null,
        uncovered: () => null,
        block: (decision) => decision.message,
      });

      if (swapBlocked !== null) {
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
        return result.reason === "outflow-reserved"
          ? result.message
          : describePinFailure(result);
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

      const expectedHash = keccak256(signed);

      if (submitPhase.kind === "approve") {
        await trackedTransactionApi.trackErc20Approve(
          submitPhase.transaction,
          expectedHash,
          "broadcast-pending",
          signed,
        );
      } else {
        await trackedTransactionApi.trackSwap(
          submitPhase.transaction,
          expectedHash,
          "broadcast-pending",
          signed,
          quote?.quotedAt ?? null,
        );
      }

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

      setSendStatus("pending");

      try {
        const receipt = await transactionApi.waitForTransactionReceipt(hash);

        if (receipt.status !== "success") {
          setSendStatus("reverted");

          return null;
        }

        if (submitPhase.kind === "approve") {
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

  if (picker) {
    return (
      <AssetPickerView
        title={picker === "pay" ? "You pay" : "You receive"}
        query={pickerQuery}
        results={pickerResults}
        loading={pickerLoading}
        error={pickerError}
        catalogueUnavailable={pickerCatalogueUnavailable}
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

  if (tradeBriefing) {
    return (
      <TokenTradeBriefingView
        intelligence={tradeBriefing}
        refreshing={briefingRefreshing}
        onCancel={() => {
          briefingRequestId.current += 1;
          setBriefingRefreshing(false);
          setBriefingAsset(null);
          setClearedTrades([]);
          setTradeBriefing(null);
        }}
        onContinue={() => {
          if (briefingRefreshing) {
            return;
          }

          const acknowledged: BriefedTrade[] = [
            ...clearedTrades,
            {
              target: {
                chainId: tradeBriefing.token.chainId,
                address: tradeBriefing.token.address,
              },
              acknowledged: true,
            },
          ];

          briefingRequestId.current += 1;
          setBriefingAsset(null);
          setClearedTrades([]);
          setTradeBriefing(null);

          void runTradeChecks(acknowledged);
        }}
        onRetry={() => {
          const requestId = ++briefingRequestId.current;

          const asset = briefingAsset;

          setBriefingRefreshing(true);

          void loadTradeIntelligence(asset, (intelligence) => {
            if (briefingRequestId.current === requestId) {
              setTradeBriefing(intelligence);
            }
          })
            .then((intelligence) => {
              if (
                intelligence &&
                briefingRequestId.current === requestId
              ) {
                setTradeBriefing(intelligence);
              }
            })
            .catch((intelligenceError) => {
              console.error(
                "Pre-trade token intelligence retry failed:",
                intelligenceError,
              );

              if (briefingRequestId.current === requestId) {
                const unavailable = unavailableTradeIntelligence(asset);

                if (unavailable) {
                  setTradeBriefing(unavailable);
                }
              }
            })
            .finally(() => {
              if (briefingRequestId.current === requestId) {
                setBriefingRefreshing(false);
              }
            });
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
        review={review}
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
      review={review}
      receive={receiveSide}
      rate={rate}
      networkFee={networkFee}
      slippage="0.5%"
      route={route}
      coverageNotice={coverageNotice}
      error={inputError ?? error}
      quoteLoading={quoteLoading}
      interactionDisabled={loading}
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
