"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useNetworkSwitcher } from "@/app/contexts/NetworkSwitcherContext";
import { useNetworkAllocation } from "@/app/hooks/useNetworkAllocation";

function truncateAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

const baseButton = "ss-btn";

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
  const padding = isSmall ? "ss-btn-sm h-10 text-sm" : "ss-btn-lg";
  // Our own switcher, not RainbowKit's: the list has to reflect what the operator has allocated.
  const { openNetworkSwitcher } = useNetworkSwitcher();
  /**
   * Connecting is refused outright while the allocation is missing.
   *
   * Not merely discouraged: a wallet connected now would land on whichever chain it happened to be
   * on, with nothing able to say whether that network is in service — and every screen behind the
   * connect button assumes that question has been answered. The banner explains why; this control
   * only has to stop being a door.
   */
  const allocation = useNetworkAllocation();
  const unavailable = allocation.isUnavailable;

  const outageTitle =
    "We can't reach the service that lists the available networks. Connecting is disabled until " +
    "it responds — retrying automatically.";

  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openConnectModal,
        mounted,
      }) => {
        if (!mounted) {
          return (
            <div
              className={`${baseButton} ss-btn-secondary ${padding} text-[var(--hero-muted)] ${className ?? ""}`}
              aria-disabled="true"
            >
              <span className="inline-block h-4 w-4 animate-pulse rounded-full bg-current opacity-60" />
              Connecting…
            </div>
          );
        }

        // The network list is missing, so there is nothing to connect *to*. Shown in place of every
        // variant of this button — connected or not — because an account modal that can switch to a
        // network nobody can vouch for is the same problem one step later.
        if (unavailable) {
          return (
            <button
              type="button"
              disabled
              title={outageTitle}
              aria-label={outageTitle}
              className={`${baseButton} ss-btn-secondary ${padding} cursor-not-allowed border-amber-500/40 bg-amber-500/10 text-amber-700 opacity-90 dark:text-amber-400 ${className ?? ""}`}
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
              Service unavailable
            </button>
          );
        }

        // Not connected
        if (!account) {
          const isPrimary = variant === "primary";
          return (
            <button
              type="button"
              onClick={openConnectModal}
              className={`${baseButton} ${
                isPrimary ? "ss-btn-primary" : "ss-btn-secondary"
              } ${padding} ${className ?? ""}`}
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
              onClick={openNetworkSwitcher}
              className={`${baseButton} ${padding} border border-amber-500/50 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-400 ${className ?? ""}`}
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
            className={`${baseButton} ss-btn-secondary ss-btn-nudge-y ${padding} ${className ?? ""}`}
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
