"use client";

import Link from "next/link";
import { CustomConnectButton } from "../CustomConnectButton";

/**
 * The screen you meet on /dashboard before a wallet is in play — and the one
 * you sit on while wagmi is still reconnecting. Both states share one shell so
 * the card never jumps between them; only the copy block swaps.
 *
 * The orbit is the whole idea in one graphic: your wallet stays at the centre,
 * the schedule circles it. Nothing here is live data.
 */

const MOTES = [
  { left: "14%", size: "4px", duration: "11s", delay: "0s" },
  { left: "28%", size: "3px", duration: "14s", delay: "2.4s" },
  { left: "46%", size: "5px", duration: "12.5s", delay: "4.8s" },
  { left: "63%", size: "3px", duration: "13.5s", delay: "1.2s" },
  { left: "78%", size: "4px", duration: "10.5s", delay: "6s" },
  { left: "90%", size: "3px", duration: "15s", delay: "3.6s" },
];

const PERKS = [
  {
    label: "Non-custodial",
    path: "M12 3l7 4v5c0 4.4-3 8.2-7 9-4-.8-7-4.6-7-9V7l7-4z M9.5 12l1.8 1.8L15 10",
  },
  { label: "Gas prepaid", path: "M13 2L4 14h6l-1 8 9-12h-6l1-8z" },
  { label: "Cancel anytime", path: "M12 7v5l3 2 M12 21a9 9 0 100-18 9 9 0 000 18z" },
];

const WALLETS = [
  { name: "Rainbow", color: "#ff5fa0" },
  { name: "MetaMask", color: "#f6851b" },
  { name: "Coinbase", color: "#2f6bff" },
  { name: "WalletConnect", color: "#3b99fc" },
];

export function ConnectWalletGate({ loading = false }: { loading?: boolean }) {
  return (
    <main className="landing-pattern-bg dashboard-surface flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden border-t border-[var(--hero-muted)]/10 px-4 pt-[5.5rem]">
      <div className="cw-shell">
        <span className="cw-aura" aria-hidden />

        <div className="cw-card">
          <span className="cw-card-grid" aria-hidden />
          <span className="cw-sheen" aria-hidden />
          <span className="cw-motes" aria-hidden>
            {MOTES.map((mote) => (
              <span
                key={mote.left}
                className="cw-mote"
                style={{
                  left: mote.left,
                  width: mote.size,
                  height: mote.size,
                  animationDuration: mote.duration,
                  animationDelay: mote.delay,
                }}
              />
            ))}
          </span>

          <div className="cw-body">
            <div className="cw-orbit" aria-hidden>
              <span className="cw-pulse" />
              <span className="cw-pulse cw-pulse-2" />

              <span className="cw-orbit-ring cw-orbit-ring-1">
                <span className="cw-sat" style={{ ["--sat" as string]: "var(--hero-accent)" }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l6 9-6 3.5L6 12l6-9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 13.6l6 7.4 6-7.4-6 3.5-6-3.5z" />
                  </svg>
                </span>
                <span
                  className="cw-sat cw-sat-b"
                  style={{ ["--sat" as string]: "var(--hero-primary)" }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="12" r="8.5" />
                    <path strokeLinecap="round" d="M12 7.5v9M14 9.8c-.4-.8-1.2-1.3-2-1.3-1.2 0-2.2.8-2.2 1.9 0 2.6 4.4 1.4 4.4 4 0 1.1-1 1.9-2.2 1.9-.9 0-1.7-.5-2.1-1.3" />
                  </svg>
                </span>
              </span>

              <span className="cw-orbit-ring cw-orbit-ring-2">
                <span className="cw-sat" style={{ ["--sat" as string]: "var(--hero-secondary)" }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="4" y="5" width="16" height="15" rx="3" />
                    <path strokeLinecap="round" d="M4 10h16M9 3v4M15 3v4" />
                    <circle cx="12" cy="15" r="1.4" fill="currentColor" stroke="none" />
                  </svg>
                </span>
              </span>

              <span className="cw-core">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 8.5A2.5 2.5 0 015.5 6H17a2 2 0 012 2v1"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 8.5v8A2.5 2.5 0 005.5 19H19a2 2 0 002-2v-6a2 2 0 00-2-2H5.5A2.5 2.5 0 013 8.5z"
                  />
                  <circle cx="16.5" cy="14" r="1.4" fill="currentColor" stroke="none" />
                </svg>
              </span>
            </div>

            {loading ? (
              <>
                <h1 className="cw-title">Loading your dashboard</h1>
                <p className="cw-sub">Reading your plans and balances from the connected network.</p>
                <span className="cw-progress" aria-hidden />
              </>
            ) : (
              <>
                <h1 className="cw-title">Connect your wallet</h1>
                <p className="cw-sub">
                  Use Rainbow or any supported wallet to view your DCA dashboard and create
                  plans. Your keys never leave your device.
                </p>

                <ul className="cw-perks">
                  {PERKS.map((perk) => (
                    <li key={perk.label} className="cw-perk">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" d={perk.path} />
                      </svg>
                      {perk.label}
                    </li>
                  ))}
                </ul>

                <div className="cw-actions">
                  <CustomConnectButton
                    label="Connect wallet"
                    size="md"
                    variant="primary"
                    className="cw-connect"
                  />
                  <Link href="/" className="ss-btn ss-btn-secondary cw-back">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Back to home
                  </Link>
                </div>

                <div className="cw-wallets">
                  <span className="cw-wallets-label">Works with</span>
                  {WALLETS.map((wallet) => (
                    <span key={wallet.name} className="cw-wallet">
                      <span
                        className="cw-wallet-dot"
                        style={{ ["--w" as string]: wallet.color }}
                        aria-hidden
                      />
                      {wallet.name}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
