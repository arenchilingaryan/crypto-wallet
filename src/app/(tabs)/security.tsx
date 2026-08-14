import { useCallback, useEffect, useState } from "react";

import { Alert } from "react-native";

import { useFocusEffect } from "expo-router";

import type { Hash } from "viem";

import { PinView } from "@/components/screens/pin-view";
import { RevokePreviewView } from "@/components/screens/revoke-preview-view";
import { SecurityView } from "@/components/screens/security-view";
import {
  SendStatusView,
  type SendStatus,
} from "@/components/screens/send-status-view";

import { ACTIVE_NETWORK } from "@/constants/networks";

import type {
  ApprovalScan,
  TokenApproval,
} from "@/core/blockchain/getApprovals";
import { getPortfolio } from "@/core/blockchain/getPortfolio";
import { createRevokePreview } from "@/core/transactions/createRevokePreview";
import type { PreparedErc20Revoke } from "@/core/transactions/erc20Revoke";
import type { PreparedPermit2Revoke } from "@/core/transactions/permit2Revoke";

import { describePinFailure } from "@/core/security/pin";
import {
  describeRemaining,
  FREEZE_DURATION_MS,
} from "@/core/security/panicFreeze";

import { panicApi } from "@/platform/react-native/panicApi";

import { securityApi } from "@/platform/react-native/securityApi";
import { signerApi } from "@/platform/react-native/signerApi";
import { transactionApi } from "@/platform/react-native/transactionApi";
import { walletApi } from "@/platform/react-native/walletApi";

export default function SecurityScreen() {
  const [scan, setScan] = useState<ApprovalScan | null>(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const [transaction, setTransaction] = useState<
    PreparedErc20Revoke | PreparedPermit2Revoke | null
  >(null);

  const [reauthing, setReauthing] = useState(false);

  const [sendStatus, setSendStatus] = useState<SendStatus | null>(null);

  const [transactionHash, setTransactionHash] = useState<Hash | null>(null);

  const [pinConfigured, setPinConfigured] = useState<boolean | null>(null);

  const [reloadNonce, setReloadNonce] = useState(0);

  const [freeze, setFreeze] = useState({ frozen: false, remainingMs: 0 });

  useEffect(() => {
    void securityApi.hasPin().then(setPinConfigured);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const refresh = () => {
        void panicApi.status().then((status) => {
          if (active) {
            setFreeze(status);
          }
        });
      };

      refresh();

      const timer = setInterval(refresh, 30_000);

      return () => {
        active = false;

        clearInterval(timer);
      };
    }, []),
  );

  function handleFreeze() {
    Alert.alert(
      "Freeze this wallet?",
      `Nothing can be sent, swapped or approved from this device for ${describeRemaining(
        FREEZE_DURATION_MS,
      )}. You will not be able to lift it early, even with your PIN. Your coins stay where they are.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Freeze",
          style: "destructive",
          onPress: () => {
            void panicApi.freeze().then(() => panicApi.status()).then(setFreeze);
          },
        },
      ],
    );
  }

  useFocusEffect(
    useCallback(() => {
      let active = true;

      void (async () => {
        try {
          setLoading(true);
          setError(null);

          const wallet = await walletApi.load();

          if (!wallet) {
            throw new Error("Active wallet not found");
          }

          const portfolio = await getPortfolio(wallet.address);

          const nextScan = await transactionApi.getApprovals(portfolio.assets);

          if (!active) {
            return;
          }

          setScan(nextScan);
        } catch (scanError) {
          console.error("Approval scan failed:", scanError);

          if (active) {
            setError("Failed to read approvals");
          }
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      })();

      return () => {
        active = false;
      };
    }, [reloadNonce]),
  );

  async function handleRevoke(approval: TokenApproval) {
    try {
      setError(null);

      const prepared =
        approval.channel === "permit2"
          ? await transactionApi.preparePermit2Revoke({
              token: approval.token,

              spender: approval.spender,

              tokenSymbol: approval.tokenSymbol,

              spenderName: approval.spenderName,
            })
          : await transactionApi.prepareErc20Revoke({
              token: approval.token,

              spender: approval.spender,

              tokenSymbol: approval.tokenSymbol,

              spenderName: approval.spenderName,
            });

      setTransaction(prepared);
    } catch (prepareError) {
      console.error("Revoke preparation failed:", prepareError);

      setError(
        prepareError instanceof Error
          ? prepareError.message
          : "Failed to prepare the transaction",
      );
    }
  }

  function resetFlow() {
    setTransaction(null);
    setReauthing(false);
    setSendStatus(null);
    setTransactionHash(null);
  }

  async function authorizeAndSend(pin: string): Promise<string | null> {
    if (!transaction) {
      return "Transaction is missing";
    }

    let authorization: string;

    try {
      const result = await securityApi.reauthorizeTransaction(pin, transaction);

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
        transaction.kind === "permit2-revoke"
          ? await signerApi.signPermit2Revoke(transaction, authorization)
          : await signerApi.signErc20Revoke(transaction, authorization);

      setReauthing(false);

      setSendStatus("broadcasting");

      const hash = await transactionApi.broadcastSignedTransaction(signed);

      setTransactionHash(hash);

      setSendStatus("pending");

      try {
        const receipt = await transactionApi.waitForTransactionReceipt(hash);

        setSendStatus(receipt.status === "success" ? "confirmed" : "reverted");
      } catch (receiptError) {
        console.error("Receipt tracking failed:", receiptError);

        setSendStatus("submitted");
      }

      return null;
    } catch (submissionError) {
      console.error("Revoke submission failed:", submissionError);

      setSendStatus(null);

      setReauthing(true);

      return submissionError instanceof Error
        ? submissionError.message
        : "Failed to send transaction";
    }
  }

  if (transaction && sendStatus) {
    return (
      <SendStatusView
        status={sendStatus}
        hash={transactionHash}
        networkName={ACTIVE_NETWORK.name}
        onDone={() => {
          resetFlow();

          setReloadNonce((nonce) => nonce + 1);
        }}
      />
    );
  }

  if (transaction && reauthing) {
    if (pinConfigured === null) {
      return null;
    }

    if (!pinConfigured) {
      return (
        <PinView
          key="revoke-setup"
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
        key="revoke-reauth"
        mode="reauth"
        onCancel={() => {
          setReauthing(false);
        }}
        onSubmit={authorizeAndSend}
      />
    );
  }

  if (transaction) {
    return (
      <RevokePreviewView
        preview={createRevokePreview(transaction, ACTIVE_NETWORK.name)}
        onBack={resetFlow}
        onConfirm={() => {
          setReauthing(true);
        }}
      />
    );
  }

  return (
    <SecurityView
      scan={scan}
      loading={loading}
      error={error}
      freeze={freeze}
      onFreeze={handleFreeze}
      onRevoke={(approval) => {
        void handleRevoke(approval);
      }}
    />
  );
}
