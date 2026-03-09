"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useDCAVault, useDCASchedule, useContracts } from "@/app/hooks";
import { calculateEarlyFee, shouldChargeEarlyFee } from "@/lib/constants";
import { formatUnits } from "viem";

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
  const { contracts } = useContracts();
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
      await cancelSchedule(Number(scheduleId));
      setSuccess(true);
      setShowConfirm(false);
      const { invalidateDcaDashboardQueries } = await import("@/lib/invalidate-dca-queries");
      await invalidateDcaDashboardQueries(queryClient);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel schedule");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <button
        disabled
        className="inline-flex items-center gap-2 px-4 py-2 bg-gray-300 text-gray-500 rounded-md cursor-not-allowed text-sm font-medium"
      >
        <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        Cancelled
      </button>
    );
  }

  if (showConfirm) {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div className="bg-[var(--background)] border border-[var(--hero-muted)]/20 rounded-2xl p-6 max-w-lg w-full shadow-2xl">
          <h3 className="text-lg font-bold mb-4 text-[var(--foreground)]">Cancel Schedule?</h3>

          {chargesEarlyFee && (
            <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <p className="text-sm text-[var(--foreground)] mb-2">
                Early cancellation fee will be charged (3% penalty):
              </p>
              <div className="space-y-1 text-sm">
                <p className="text-[var(--foreground)]">
                  Remaining: {formatUnits(remainingAmount, 6)} USDC
                </p>
                <p className="text-red-400 font-medium">
                  Fee (3%): {formatUnits(earlyFee, 6)} USDC
                </p>
                <p className="text-green-400 font-medium">
                  {"You'll"} receive: {formatUnits(netReturn, 6)} USDC
                </p>
              </div>
            </div>
          )}

          {!chargesEarlyFee && (
            <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
              <p className="text-sm text-green-400 font-medium">
                No early cancellation fee (over 50% already executed)
              </p>
              <p className="text-sm text-[var(--foreground)] mt-1">
                {"You'll"} receive: {formatUnits(remainingAmount, 6)} USDC
              </p>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => setShowConfirm(false)}
              disabled={isSubmitting || isLoading}
              className="inline-flex flex-1 items-center justify-center gap-2 px-4 py-2 border border-[var(--hero-muted)]/30 rounded-lg text-[var(--foreground)] hover:bg-[var(--hero-muted)]/10 disabled:opacity-50 transition"
            >
              <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Keep Schedule
            </button>
            <button
              onClick={handleCancel}
              disabled={isSubmitting || isLoading}
              className="inline-flex flex-1 items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition"
            >
              {isSubmitting || isLoading ? (
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
                  Confirm
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      className="inline-flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition text-sm font-medium"
    >
      <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
      Cancel Schedule
    </button>
  );
};
