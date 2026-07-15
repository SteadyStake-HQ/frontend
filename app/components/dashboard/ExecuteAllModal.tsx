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

/** Inner glyph for a timeline node. The spinning ring is drawn by CSS on the
 *  node itself, so the executing state carries no glyph of its own. */
function NodeIcon({ status }: { status: ExecutionStepStatus }) {
  if (status === "success") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    );
  }
  if (status === "error") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    );
  }
  // pending + executing share a small core dot; CSS animates each differently.
  return <span className="ea-node-core" aria-hidden />;
}

function StatusBadge({ status }: { status: ExecutionStepStatus }) {
  const labels: Record<ExecutionStepStatus, string> = {
    pending: "Pending",
    executing: "Executing",
    success: "Done",
    error: "Failed",
  };
  return (
    <span className={`ea-badge ea-badge-${status}`}>
      {status === "executing" && <span className="ea-badge-spin" aria-hidden />}
      {status === "success" && (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
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
  const errorCount = items.filter((i) => statusMap[i.scheduleId] === "error").length;
  const processed = successCount + errorCount;
  const total = items.length || 1;
  const pct = Math.round((processed / total) * 100);
  const allSucceeded = !isRunning && errorCount === 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="execute-all-title"
      className="ea-overlay"
      onClick={(e) => {
        if (isRunning) return;
        if (contentRef.current && !contentRef.current.contains(e.target as Node)) onClose();
      }}
    >
      <div className="ea-veil" aria-hidden>
        <span className="ea-bloom ea-bloom-a" />
        <span className="ea-bloom ea-bloom-b" />
      </div>

      <div ref={contentRef} className="ea-shell" onClick={(e) => e.stopPropagation()}>
        <span className="ea-edge" aria-hidden />

        {/* Header */}
        <div className="ea-head">
          <span className="ea-head-grid" aria-hidden />
          <span className="ea-head-sheen" aria-hidden />

          <div className="ea-head-row">
            <span className={`ea-head-mark ${isRunning ? "is-running" : ""}`} aria-hidden>
              <span className="ea-head-ring" />
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </span>

            <div className="ea-head-copy">
              <h2 id="execute-all-title" className="ea-title">
                Execute All
              </h2>
              <p className="ea-sub">
                {isRunning
                  ? "Running DCA swaps…"
                  : allSucceeded
                    ? `All ${items.length} swaps completed`
                    : `${successCount} of ${items.length} completed · ${errorCount} failed`}
              </p>
            </div>

            {!isRunning && (
              <button
                type="button"
                onClick={onClose}
                className="ea-close"
                aria-label="Close"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          <div
            className={`ea-prog ${isRunning ? "is-running" : ""}`}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Execution progress"
          >
            <span className="ea-prog-fill" style={{ width: `${pct}%` }}>
              <span className="ea-prog-stripes" aria-hidden />
            </span>
          </div>
        </div>

        {/* Timeline */}
        <div className="ea-body">
          <ol className="ea-list">
            {items.map((item, idx) => {
              const status = statusMap[item.scheduleId] ?? "pending";
              const errorMsg = errorBySchedule[item.scheduleId];
              return (
                <li
                  key={item.scheduleId}
                  className={`ea-item ea-item-${status}`}
                  style={{ ["--i" as string]: idx }}
                >
                  <span className="ea-node" aria-hidden>
                    <NodeIcon status={status} />
                  </span>

                  <div className="ea-card">
                    <span className="ea-card-sheen" aria-hidden />
                    <div className="ea-card-row">
                      <p className="ea-amount">
                        ${item.plan.amountPerInterval}{" "}
                        <span className="ea-token">{item.plan.targetToken}</span>
                        <span className="ea-freq"> / {item.plan.frequency}</span>
                      </p>
                      <StatusBadge status={status} />
                    </div>
                    <p className="ea-schedule">Schedule #{item.scheduleId}</p>
                    {status === "error" && errorMsg && (
                      <p className="ea-item-error-msg">{errorMsg}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        {!isRunning && (
          <div className="ea-foot">
            <p className="ea-foot-hint">
              {allSucceeded ? (
                <>
                  <b>All done.</b> Your DCA swaps executed successfully.
                </>
              ) : (
                <>
                  <b>{successCount} succeeded</b>
                  {errorCount > 0 ? `, ${errorCount} failed. You can retry failed swaps.` : "."}
                </>
              )}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="ss-btn ss-btn-primary ea-foot-btn"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
