"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useChainId, usePublicClient } from "wagmi";
import { useDCAVault, useDCASchedule, useContracts, useStableSymbol } from "@/app/hooks";
import { calculateEarlyFee, shouldChargeEarlyFee } from "@/lib/constants";
import { formatUnits } from "viem";
import { getStableDecimals } from "@/config/contracts";
import { parseTxError } from "@/lib/parse-tx-error";

interface CancelScheduleButtonProps {
  scheduleId: bigint;
}

interface ScheduleData {
  targetToken: `0x${string}`;
  frequency: number;
  amountPerInterval: bigint;
  lastExecutionTime: bigint;
  totalAmount: bigint;
  executedCount: bigint;
  active: boolean;
}

export const CancelScheduleButton = ({ scheduleId }: CancelScheduleButtonProps) => {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const queryClient = useQueryClient();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { contracts } = useContracts();
  const stable = useStableSymbol();
  const { cancelSchedule, isLoading } = useDCAVault();
  const { schedule: rawSchedule } = useDCASchedule(scheduleId);

  if (!rawSchedule) return null;

  const schedule = rawSchedule as unknown as ScheduleData;
  const totalAmount: bigint = schedule.totalAmount;
  const amountPerInterval: bigint = schedule.amountPerInterval;
  const executedCount: bigint = schedule.executedCount;

  const totalExecutedNum = amountPerInterval * executedCount;
  const remainingAmount = totalAmount - totalExecutedNum;

  const chargesEarlyFee = shouldChargeEarlyFee(
    totalAmount,
    amountPerInterval,
    Number(executedCount)
  );
  const earlyFee = chargesEarlyFee ? calculateEarlyFee(remainingAmount) : (0n as bigint);
  const netReturn = remainingAmount - earlyFee;

  const handleCancel = async () => {
    setError(null);
    setIsSubmitting(true);

    try {
      const hash = (await cancelSchedule(Number(scheduleId))) as `0x${string}`;

      // Record the cancellation once it's mined. The refunded amount and end date only exist in
      // this transaction's receipt — the vault zeroes the schedule out — so if we don't store them
      // now the plan's history is lost. Failing to record must not fail the cancel itself: the
      // cancel already succeeded on-chain by this point.
      try {
        if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
        const res = await fetch("/api/plans/record", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chainId, txHash: hash }),
        });
        if (!res.ok) console.error("[CancelScheduleButton] plan record failed:", await res.text());
      } catch (e) {
        console.error("[CancelScheduleButton] plan record failed:", e);
      }

      setSuccess(true);
      setShowConfirm(false);
      const { invalidateDcaDashboardQueries } = await import("@/lib/invalidate-dca-queries");
      await invalidateDcaDashboardQueries(queryClient);
    } catch (err) {
      setError(parseTxError(err, "Failed to cancel schedule"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <button disabled className="ss-btn ss-btn-soft ss-btn-sm">
        <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        Cancelled
      </button>
    );
  }

  if (showConfirm) {
    const decimals = getStableDecimals(chainId);
    const fmt = (v: bigint) =>
      Number(formatUnits(v, decimals)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const busy = isSubmitting || isLoading;
    // How far along the plan is, against the halfway line past which cancelling is free.
    const done = totalAmount > 0n ? Number((totalExecutedNum * 1000n) / totalAmount) / 10 : 0;
    const feeShare = remainingAmount > 0n ? Number((earlyFee * 1000n) / remainingAmount) / 10 : 0;

    return (
      <div
        className="dx-confirm-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`cancel-title-${scheduleId}`}
        onClick={() => !busy && setShowConfirm(false)}
      >
        <div className="dx-confirm" onClick={(e) => e.stopPropagation()}>
          <span className="dx-confirm-mark" aria-hidden>
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </span>
          <h3 id={`cancel-title-${scheduleId}`}>Cancel plan #{scheduleId.toString()}?</h3>

          {/* Where the unspent funds go: back to the wallet, less any early fee. */}
          <div className="dx-refund">
            <div className="dx-refund-head">
              <span>Back to wallet</span>
              <b>
                {fmt(chargesEarlyFee ? netReturn : remainingAmount)} <small>{stable}</small>
              </b>
            </div>
            <div className="dx-refund-bar" aria-hidden>
              <i className="is-back" style={{ flexGrow: Math.max(0.0001, 100 - feeShare) }} />
              {chargesEarlyFee && <i className="is-fee" style={{ flexGrow: Math.max(0.0001, feeShare) }} />}
            </div>
            <div className="dx-refund-legend">
              <span>
                <i className="is-back" />
                Refund
              </span>
              {chargesEarlyFee ? (
                <span className="is-fee">
                  <i className="is-fee" />
                  Fee 3% · {fmt(earlyFee)}
                </span>
              ) : (
                <span className="is-free">No fee</span>
              )}
              <span className="dx-refund-of">of {fmt(remainingAmount)} unspent</span>
            </div>
          </div>

          {/* The fee rule, drawn: progress so far against the 50% line. */}
          <div className="dx-feeline" title="Cancelling before half the plan has run charges 3% of what is left.">
            <div className="dx-feeline-track" aria-hidden>
              <i style={{ width: `${Math.min(100, done)}%` }} />
              <b style={{ left: "50%" }} />
            </div>
            <div className="dx-feeline-legend">
              <span>{Math.round(done)}% bought</span>
              <span>fee-free from 50%</span>
            </div>
          </div>

          {error && (
            <p className="dx-confirm-error" role="alert">
              {error}
            </p>
          )}

          <div className="dx-confirm-actions">
            <button onClick={() => setShowConfirm(false)} disabled={busy} className="ss-btn ss-btn-soft ss-btn-block flex-1">
              Keep plan
            </button>
            <button
              onClick={handleCancel}
              disabled={busy}
              data-loading={busy ? "true" : undefined}
              className="ss-btn ss-btn-danger ss-btn-block flex-1"
            >
              {busy ? (
                <>
                  <svg className="h-4 w-4 shrink-0 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity={0.25} />
                    <path fill="currentColor" d="M12 2a10 10 0 0 1 10 10h-2a8 8 0 0 0-8-8V2z" />
                  </svg>
                  Processing...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Cancel &amp; refund
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button onClick={() => setShowConfirm(true)} className="ss-btn ss-btn-danger ss-btn-sm">
      <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
      Cancel Schedule
    </button>
  );
};
