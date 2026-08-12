import { useCallback, useEffect, useState } from "react";

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

import { securityApi } from "@/platform/react-native/securityApi";
import { signerApi } from "@/platform/react-native/signerApi";
import { transactionApi } from "@/platform/react-native/transactionApi";
import { walletApi } from "@/platform/react-native/walletApi";

export default function SecurityScreen() {
  const [scan, setScan] = useState<ApprovalScan | null>(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const [transaction, setTransaction] = useState<PreparedErc20Revoke | null>(
    null,
  );

  const [reauthing, setReauthing] = useState(false);

  const [sendStatus, setSendStatus] = useState<SendStatus | null>(null);

  const [transactionHash, setTransactionHash] = useState<Hash | null>(null);

  const [pinConfigured, setPinConfigured] = useState<boolean | null>(null);

  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    void securityApi.hasPin().then(setPinConfigured);
  }, []);

  // Перечитываем на каждом фокусе: разрешения меняются свопами из
  // соседних экранов, а вкладка не размонтируется.
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

      const prepared = await transactionApi.prepareErc20Revoke({
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
      const signed = await signerApi.signErc20Revoke(
        transaction,
        authorization,
      );

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

          // Список пересобираем: разрешения только что изменились.
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
      onRevoke={(approval) => {
        void handleRevoke(approval);
      }}
    />
  );
}
