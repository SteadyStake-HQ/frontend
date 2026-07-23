"use client";

import { useState } from "react";
import { usePublicClient, useWriteContract } from "wagmi";
import { useContracts } from "@/app/hooks";
import { DCA_VAULT_ABI } from "@/config/abis";
import { parseTxError } from "@/lib/parse-tx-error";

interface ExecuteSwapButtonProps {
  userAddress: string;
  scheduleId: bigint;
  isReady: boolean;
  onSuccess?: () => void;
  disabled?: boolean;
  /** Backend-reported execution in progress, from any client. */
  executionMode?: "auto" | "manual" | null;
}

function Spinner() {
  return (
    <svg className="h-4 w-4 shrink-0 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity={0.25} />
      <path fill="currentColor" d="M12 2a10 10 0 0 1 10 10h-2a8 8 0 0 0-8-8V2z" />
    </svg>
  );
}

export function ExecuteSwapButton({
  userAddress,
  scheduleId,
  isReady,
  onSuccess,
  disabled,
  executionMode = null,
}: ExecuteSwapButtonProps) {
  const { chainId, contracts } = useContracts();
  const { writeContract } = useWriteContract();
  const publicClient = usePublicClient();
  const [error, setError] = useState<string | null>(null);
  // Spans signing through mining. `useWriteContract`'s own pending flag drops as soon as the
  // transaction is sent, which would free the button while the swap is still in flight.
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Publishes this wallet-signed execution so the operator dashboard holds its button too.
   * Advisory only — the vault's cooldown is what actually prevents a double swap — so a failure
   * here must never block the execution itself.
   */
  const reportExecuting = async (executing: boolean) => {
    try {
      await fetch("/api/plans/executing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chainId,
          userAddress,
          scheduleId: scheduleId.toString(),
          executing,
        }),
      });
    } catch {
      // Ignored: the backend mark expires on its own.
    }
  };

  const handleExecute = async () => {
    setError(null);
    setIsSubmitting(true);
    await reportExecuting(true);

    const settle = async () => {
      await reportExecuting(false);
      setIsSubmitting(false);
    };

    try {
      await writeContract(
        {
          address: contracts.DCAVault as `0x${string}`,
          abi: DCA_VAULT_ABI,
          functionName: "executeSwap",
          args: [userAddress as `0x${string}`, scheduleId, "0x"],
          chainId,
        },
        {
          onSuccess: async (hash) => {
            // Wait for the receipt rather than guessing: releasing the button before the swap is
            // mined invites a second click that the vault would only reject after spending gas.
            try {
              await publicClient?.waitForTransactionReceipt({ hash });
            } catch {
              // Fall through — the plan's cooldown reflects the real outcome either way.
            }
            await settle();
            onSuccess?.();
          },
          onError: async (err) => {
            setError(parseTxError(err, "Failed to execute swap"));
            await settle();
          },
        }
      );
    } catch (err) {
      setError(parseTxError(err, "Failed to execute swap"));
      await settle();
    }
  };

  // A run reported by the backend (scheduler or another client) outranks the local idle state.
  if (executionMode !== null) {
    return (
      <button
        type="button"
        disabled
        className="ss-btn ss-btn-success ss-btn-sm ss-btn-play min-w-[130px]"
      >
        <Spinner />
        {executionMode === "auto" ? "Auto Executing..." : "Executing..."}
      </button>
    );
  }

  if (!isReady && !isSubmitting) {
    return (
      <span className="plan-cooldown-chip" title="Next run is in cooldown">
        <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Not ready
      </span>
    );
  }

  return (
    <div>
      <button
        onClick={handleExecute}
        disabled={isSubmitting || disabled}
        data-loading={isSubmitting ? "true" : undefined}
        className="ss-btn ss-btn-success ss-btn-sm ss-btn-play min-w-[130px]"
      >
        {isSubmitting ? (
          <>
            <Spinner />
            Executing...
          </>
        ) : (
          <>
            <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path d="M8 5v14l11-7L8 5z" />
            </svg>
            Execute Now
          </>
        )}
      </button>
      {error && (
        <p className="mt-2 text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
