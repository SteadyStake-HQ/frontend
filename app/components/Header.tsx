"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAccount } from "wagmi";
import { CHAIN_ICON_URLS } from "@/config/wagmi";
import { useNetworkAllocation } from "@/app/hooks/useNetworkAllocation";
import { useNetworkSwitcher } from "@/app/contexts/NetworkSwitcherContext";
import { CustomConnectButton } from "./CustomConnectButton";
import { ThemeSwitcher } from "./ThemeSwitcher";

function NetworkIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <ellipse cx="12" cy="12" rx="10" ry="4" />
      <line x1="2" y1="12" x2="22" y2="12" />
    </svg>
  );
}

function StartDCAIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 20V10" />
      <path d="M18 20V4" />
      <path d="M6 20v-4" />
    </svg>
  );
}

function SwitchNetworkButton({ large = false }: { large?: boolean }) {
  const { openNetworkSwitcher } = useNetworkSwitcher();
  const { chain, isConnected } = useAccount();
  const allocation = useNetworkAllocation();
  const [mounted, setMounted] = useState(false);
  const [iconError, setIconError] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  const label = mounted && isConnected && chain?.name ? chain.name : "Network";
  const chainIconUrl =
    mounted && chain && !iconError
      ? (chain.id != null && CHAIN_ICON_URLS[chain.id]) ||
        ("iconUrl" in chain &&
        typeof (chain as { iconUrl?: string }).iconUrl === "string"
          ? (chain as { iconUrl: string }).iconUrl
          : undefined)
      : undefined;

  useEffect(() => {
    queueMicrotask(() => setIconError(false));
  }, [chain?.id]);

  const iconSize = large ? "h-6 w-6" : "h-5 w-5";
  const chevronSize = large ? "h-4 w-4" : "h-3.5 w-3.5";
  const btnClass = large
    ? "ss-btn ss-btn-secondary ss-btn-sm ss-btn-nudge-y h-10 px-4 text-sm"
    : "ss-btn ss-btn-secondary ss-btn-sm ss-btn-nudge-y h-10 gap-1.5 px-2.5";

  /**
   * The operator has taken this network out of service. Worth saying on the switcher itself: the
   * user's plans are still there and still theirs, but nothing new will run until it is resumed, and
   * the fix is to switch networks.
   *
   * `unavailable` is the other reason nothing is on offer — the allocation could not be read at all.
   * It gets its own wording because the fix is not to switch networks; there is nothing to switch to
   * until the service answers.
   */
  const unavailable = mounted && allocation.isUnavailable;
  const outOfService =
    mounted && isConnected && chain?.id != null && !allocation.acceptsNewPlans(chain.id);
  const paused = outOfService && !unavailable && chain?.id != null && allocation.isPaused(chain.id);
  const title = unavailable
    ? "Networks unavailable — we can't reach the service that lists them"
    : outOfService
      ? `${chain?.name ?? "This network"} is ${paused ? "paused" : "not in service"} — switch network`
      : "Switch network";

  return (
    <button
      type="button"
      onClick={openNetworkSwitcher}
      className={btnClass}
      title={title}
      aria-label={title}
      data-network-paused={outOfService ? "true" : undefined}
    >
      {chainIconUrl ? (
        <span
          className={`flex ${iconSize} shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--hero-muted)]/10 ring-1 ring-[var(--hero-muted)]/10`}
        >
          <img
            src={chainIconUrl}
            alt=""
            className="h-full w-full object-contain"
            width={large ? 24 : 20}
            height={large ? 24 : 20}
            onError={() => setIconError(true)}
          />
        </span>
      ) : (
        <NetworkIcon className={`${iconSize} shrink-0 text-current`} />
      )}
      <span className="hidden sm:inline">{label}</span>
      {outOfService ? (
        <span
          className="hidden shrink-0 rounded-full bg-amber-400/15 px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide text-amber-500 sm:inline"
          title={title}
        >
          {unavailable ? "Unavailable" : paused ? "Paused" : "Offline"}
        </span>
      ) : null}
      <svg
        className={`${chevronSize} shrink-0 text-current hidden sm:block`}
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
}

export function Header() {
  const pathname = usePathname();
  const { isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);
  const isDashboard = pathname?.startsWith("/dashboard") ?? false;

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  const headerTransparent = true;
  const headerPositionClass = "absolute top-0 left-0 right-0";
  return (
    <header
      className={`${headerPositionClass} z-50 flex w-full items-center transition-colors duration-300 ${
        headerTransparent
          ? "border-b border-transparent bg-transparent backdrop-blur-none"
          : "border-b border-[var(--hero-muted)]/15 bg-[var(--background)] backdrop-blur-md"
      } ${isDashboard ? "min-h-[5.5rem]" : "min-h-[4.5rem]"}`}
    >
      <div
        className={`mx-auto flex w-full max-w-7xl flex-1 items-center justify-between gap-3 px-4 ${isDashboard ? "py-3" : "py-2"}`}
      >
          <Link
            href="/"
            className="hd-brand"
            aria-label="SteadyStake home"
          >
            <span className="hd-brand-mark" aria-hidden="true">
              <span className="hd-brand-halo" />
              <Image
                src="/logo.png"
                alt=""
                width={42}
                height={40}
                priority
                className="hd-brand-logo"
              />
            </span>
            <span className="hd-brand-copy">
              <span className="hd-brand-wordmark">
                <span className="hd-brand-steady">Steady</span>
                <span className="hd-brand-stake">Stake</span>
              </span>
              <span className="hd-brand-tagline">Automated crypto savings</span>
            </span>
          </Link>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <ThemeSwitcher />
          {mounted && isConnected && (
            <SwitchNetworkButton large={isDashboard} />
          )}
          <CustomConnectButton
            label="Connect wallet"
            size="sm"
            variant="secondary"
            className={mounted && isConnected ? "h-10 rounded-xl" : ""}
          />
          {!isDashboard && (
            <Link
              href="/dashboard"
              className="ss-btn ss-btn-primary ss-btn-sm ss-btn-glow h-10"
            >
              <StartDCAIcon className="h-4 w-4 shrink-0" />
              Start DCA
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
