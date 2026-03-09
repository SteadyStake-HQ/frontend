"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

function truncateAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

const baseButton =
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hero-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] active:scale-[0.98]";

export interface CustomConnectButtonProps {
  /** Label when disconnected (e.g. "Connect wallet" or "Start DCA — Connect wallet") */
  label?: string;
  /** "sm" for header, "md" for hero CTA */
  size?: "sm" | "md";
  /** "primary" = filled green, "secondary" = outline */
  variant?: "primary" | "secondary";
  /** When connected, show native balance (e.g. "0.5 ETH") */
  showBalance?: boolean;
  /** Optional extra class for the root button/div */
  className?: string;
}

export function CustomConnectButton({
  label = "Connect wallet",
  size = "md",
  variant = "primary",
  showBalance = false,
  className,
}: CustomConnectButtonProps) {
  const isSmall = size === "sm";
  const padding = isSmall ? "h-10 px-3 text-sm rounded-xl" : "px-6 py-3 text-base";

  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted,
      }) => {
        if (!mounted) {
          return (
            <div
              className={`${baseButton} ${padding} border border-[var(--hero-muted)]/20 bg-[var(--hero-muted)]/10 text-[var(--hero-muted)] ${className ?? ""}`}
            >
              <span className="inline-block h-4 w-4 animate-pulse rounded-full bg-current opacity-60" />
              Connecting…
            </div>
          );
        }

        // Not connected
        if (!account) {
          const isPrimary = variant === "primary";
          return (
            <button
              type="button"
              onClick={openConnectModal}
              className={`${baseButton} ${padding} ${
                isPrimary
                  ? "bg-[linear-gradient(90deg,#ff4fa3_0%,#8b5cf6_55%,#38bdf8_100%)] text-white shadow-[0_8px_26px_rgba(255,79,163,0.32)] hover:brightness-110 hover:shadow-[0_10px_30px_rgba(139,92,246,0.4)]"
                  : "border border-[var(--hero-muted)]/30 bg-transparent text-[var(--foreground)] hover:border-[var(--hero-primary)]/50 hover:bg-[color-mix(in_srgb,var(--hero-primary)_0.08,transparent)]"
              } ${className ?? ""}`}
            >
              <svg
                className="h-5 w-5 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                />
              </svg>
              {label}
            </button>
          );
        }

        // Wrong network
        if (chain?.unsupported) {
          return (
            <button
              type="button"
              onClick={openChainModal}
              className={`${baseButton} ${padding} border border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400 ${className ?? ""}`}
            >
              <svg
                className="h-5 w-5 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              Wrong network
              <span className="text-xs opacity-90">Switch</span>
            </button>
          );
        }

        // Connected: show chain + address (+ optional balance)
        return (
          <button
            type="button"
            onClick={openAccountModal}
            className={`${baseButton} ${padding} border border-[var(--hero-muted)]/20 bg-[color-mix(in_srgb,var(--foreground)_0.04)] text-[var(--foreground)] hover:border-[var(--hero-primary)]/30 hover:bg-[color-mix(in_srgb,var(--hero-primary)_0.06)] ${className ?? ""}`}
          >
            {chain?.hasIcon && chain.iconUrl && (
              <img
                src={chain.iconUrl}
                alt=""
                className="h-5 w-5 shrink-0 rounded-full"
                width={20}
                height={20}
              />
            )}
            {showBalance && account.displayBalance && (
              <span className="hidden text-sm text-[var(--hero-muted)] sm:inline">
                {account.displayBalance}
              </span>
            )}
            <span className="font-mono text-sm tabular-nums">
              {account.displayName ?? truncateAddress(account.address)}
            </span>
            <svg
              className="h-4 w-4 shrink-0 opacity-60"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
}
