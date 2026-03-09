"use client";

import { useRef } from "react";

export type ExecutionStepStatus = "pending" | "executing" | "success" | "error";

export interface ExecuteAllModalItem {
  scheduleId: string;
  plan: {
    targetToken: string;
    amountPerInterval: string;
    frequency: string;
  };
}

interface ExecuteAllModalProps {
  open: boolean;
  onClose: () => void;
  items: ExecuteAllModalItem[];
  statusMap: Record<string, ExecutionStepStatus>;
  errorBySchedule: Record<string, string>;
  isRunning: boolean;
}

/** Icon only (circle is provided by DaisyUI step-icon). */
function StepIcon({ status }: { status: ExecutionStepStatus }) {
  if (status === "pending") {
    return <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" aria-hidden />;
  }
  if (status === "executing") {
    return (
      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity={0.25} />
        <path fill="currentColor" d="M12 2a10 10 0 0 1 10 10h-2a8 8 0 0 0-8-8V2z" />
      </svg>
    );
  }
  if (status === "success") {
    return (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    );
  }
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function StatusBadge({ status }: { status: ExecutionStepStatus }) {
  const labels: Record<ExecutionStepStatus, string> = {
    pending: "Pending",
    executing: "Executing",
    success: "Done",
    error: "Failed",
  };
  const badgeClass =
    status === "pending"
      ? "badge-ghost"
      : status === "executing"
        ? "badge-primary badge-outline"
        : status === "success"
          ? "badge-success badge-outline"
          : "badge-error badge-outline";
  return (
    <span className={`badge badge-sm ${badgeClass}`}>
      {status === "executing" && (
        <span className="loading loading-spinner loading-xs mr-1" />
        )}
      {labels[status]}
    </span>
  );
}

export function ExecuteAllModal({
  open,
  onClose,
  items,
  statusMap,
  errorBySchedule,
  isRunning,
}: ExecuteAllModalProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  if (!open) return null;

  const successCount = items.filter((i) => statusMap[i.scheduleId] === "success").length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="execute-all-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (contentRef.current && !contentRef.current.contains(e.target as Node)) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-hidden />
      <div
        ref={contentRef}
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-base-300/50 bg-base-100 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-6 py-5 text-white"
          style={{
            background: "linear-gradient(135deg, var(--hero-primary) 0%, var(--hero-secondary) 100%)",
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <div>
                <h2 id="execute-all-title" className="text-lg font-bold tracking-tight">
                  Execute All
                </h2>
                <p className="mt-0.5 text-sm text-white/90">
                  {isRunning
                    ? "Running DCA swaps…"
                    : `${successCount} of ${items.length} completed`}
                </p>
              </div>
            </div>
            {!isRunning && (
              <button
                type="button"
                onClick={onClose}
                className="btn btn-ghost btn-sm btn-circle text-white/90 hover:bg-white/20"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Timeline: DaisyUI vertical steps */}
        <div className="max-h-[60vh] overflow-y-auto p-6">
          <ul className="steps steps-vertical w-full">
            {items.map((item) => {
              const status = statusMap[item.scheduleId] ?? "pending";
              const errorMsg = errorBySchedule[item.scheduleId];
              const stepModifier =
                status === "pending"
                  ? "step-neutral"
                  : status === "executing"
                    ? "step-primary"
                    : status === "success"
                      ? "step-success"
                      : "step-error";
              return (
                <li key={item.scheduleId} className={`step ${stepModifier}`}>
                  <span className="step-icon">
                    <StepIcon status={status} />
                  </span>
                  <div className="w-full pt-0.5">
                    <div className="rounded-xl border border-base-300/50 bg-base-200/30 px-4 py-3 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold text-base-content">
                          ${item.plan.amountPerInterval} {item.plan.targetToken}
                          <span className="font-normal text-base-content/70"> / {item.plan.frequency}</span>
                        </p>
                        <StatusBadge status={status} />
                      </div>
                      <p className="mt-1 text-xs text-base-content/60">
                        Schedule #{item.scheduleId}
                      </p>
                      {status === "error" && errorMsg && (
                        <p className="mt-2 text-xs text-error">{errorMsg}</p>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {!isRunning && (
          <div className="border-t border-base-300/30 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-primary w-full rounded-xl gap-2"
            >
              <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
