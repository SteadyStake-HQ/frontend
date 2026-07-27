"use client";

import Link from "next/link";
import { useNetworkSwitcher } from "@/app/contexts/NetworkSwitcherContext";

/**
 * The screen that stands in for the whole dashboard while the wallet is on a network the operator
 * has taken out of service.
 *
 * This is a hard gate, not a banner: nothing behind it renders, and the page stops fetching plans,
 * balances, and prices for the chain entirely. A paused network is meant to behave as though the app
 * does not run there at all, so no feature can be reached from it — the only way forward is to
 * switch to a network that is in service.
 *
 * It shares the ConnectWalletGate shell (`cw-*`) so the two gates read as one screen with different
 * copy rather than as two different products.
 */
export function NetworkOutOfServiceGate({
  chainName,
  paused,
  note,
}: {
  chainName: string;
  /** Paused rather than removed. Only the wording differs; both are equally closed. */
  paused: boolean;
  /** The operator's explanation, when they left one. */
  note: string | null;
}) {
  const { openNetworkSwitcher } = useNetworkSwitcher();
  const state = paused ? "paused" : "no longer in service";

  return (
    <main className="landing-pattern-bg dashboard-surface flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden border-t border-[var(--hero-muted)]/10 px-4 pt-[5.5rem]">
      <div className="cw-shell">
        <span className="cw-aura" aria-hidden />

        <div className="cw-card">
          <span className="cw-card-grid" aria-hidden />
          <span className="cw-sheen" aria-hidden />

          <div className="cw-body">
            <span className="nsg-emblem" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <circle cx="12" cy="12" r="9" />
                <path strokeLinecap="round" d="M10 9.5v5M14 9.5v5" />
              </svg>
            </span>

            <h1 className="cw-title">{chainName} is {state}</h1>
            <p className="cw-sub">
              {note ??
                `The dashboard is closed on this network. No plans, balances, or executions are
                 available here until it is back in service.`}
            </p>

            <p className="nsg-hint">Switch to a network that is in service to continue.</p>

            <div className="cw-actions">
              <button
                type="button"
                onClick={openNetworkSwitcher}
                className="ss-btn ss-btn-primary ss-btn-lg cw-connect"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 7h13m0 0l-3-3m3 3l-3 3M20 17H7m0 0l3 3m-3-3l3-3"
                  />
                </svg>
                Switch network
              </button>
              <Link href="/" className="ss-btn ss-btn-secondary cw-back">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
                Back to home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
