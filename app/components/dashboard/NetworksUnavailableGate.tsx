"use client";

import Link from "next/link";

/**
 * The screen that stands in for the whole dashboard when the list of available networks cannot be
 * read from the backend.
 *
 * This is a hard gate rather than a warning banner because the missing answer is the one that says
 * which networks are in service. Without it the app cannot tell a live network from a paused or
 * retired one, and every screen behind here — plans, balances, gas tank, the new-plan modal — would
 * be acting on a guess. Nothing behind it renders and nothing is fetched.
 *
 * It retries on its own (see useNetworkAllocation), so this screen replaces itself once the service
 * answers; the reload button is for users who would rather not wait.
 *
 * It shares the ConnectWalletGate shell (`cw-*`) so the gates read as one screen with different
 * copy rather than as different products.
 */
export function NetworksUnavailableGate() {
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
                <ellipse cx="12" cy="12" rx="9" ry="3.6" />
                <path strokeLinecap="round" d="M4.5 6.5l15 11" />
              </svg>
            </span>

            <h1 className="cw-title">Networks unavailable</h1>
            <p className="cw-sub">
              We can&apos;t reach the service that says which networks are currently in service, so
              the dashboard is closed and no network can be selected. Your plans and funds are
              untouched — this is a connection problem on our side, not a change to your account.
            </p>

            <p className="nsg-hint">Retrying automatically. This page will open as soon as it responds.</p>

            <div className="cw-actions">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="ss-btn ss-btn-primary ss-btn-lg cw-connect"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h5M20 20v-5h-5M19.4 9A7.5 7.5 0 006.3 6.3M4.6 15a7.5 7.5 0 0013.1 2.7"
                  />
                </svg>
                Try again
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
