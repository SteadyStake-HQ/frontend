"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useChainModal } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { CHAIN_ICON_URLS } from "@/config/wagmi";
import { CustomConnectButton } from "./CustomConnectButton";
import { ThemeSwitcher } from "./ThemeSwitcher";

const NAV = [
  { label: "Home", href: "/" },
  { label: "Problem", href: "#problem" },
  { label: "Networks", href: "#networks" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Roadmap", href: "#roadmap" },
] as const;

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
  const { openChainModal } = useChainModal();
  const { chain, isConnected } = useAccount();
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
    ? "flex h-10 items-center gap-2 rounded-xl border border-[var(--hero-muted)]/20 bg-[color-mix(in_srgb,var(--foreground)_0.04)] px-4 text-sm font-medium text-[var(--foreground)] transition-colors hover:border-[var(--hero-primary)]/30 hover:bg-[var(--hero-primary)]/5"
    : "flex h-10 items-center gap-1.5 rounded-xl border border-[var(--hero-muted)]/20 bg-[color-mix(in_srgb,var(--foreground)_0.04)] px-2.5 text-xs font-medium text-[var(--foreground)] transition-colors hover:border-[var(--hero-primary)]/30 hover:bg-[var(--hero-primary)]/5";

  return (
    <button
      type="button"
      onClick={openChainModal}
      className={btnClass}
      title="Switch network"
      aria-label="Switch network"
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
        className={`mx-auto flex w-full max-w-7xl flex-1 justify-between gap-2 px-4 ${isDashboard ? "py-3" : "py-2"}`}
      >
        <div className="flex items-center gap-2 md:gap-4">
          <Link
            href="/"
            className="flex items-center text-[26px] font-bold tracking-tight transition-opacity hover:opacity-90"
            style={{
              background:
                "linear-gradient(135deg, var(--hero-primary), var(--hero-secondary))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            SteadyStake
          </Link>
          {!isDashboard && (
            <nav
              className="hidden items-center gap-1 md:flex"
              aria-label="Main"
            >
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-2.5 py-1.5 text-sm font-semibold transition-colors ${
                    headerTransparent
                      ? "text-[var(--foreground)]/92 hover:bg-[var(--hero-muted)]/12 hover:text-[var(--foreground)]"
                      : "text-[var(--foreground)]/90 hover:bg-[var(--hero-muted)]/10 hover:text-[var(--foreground)]"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          )}
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
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
              className="startdca-btn flex h-10 items-center gap-2 rounded-xl px-3 text-xs font-semibold text-white shadow-[0_0_12px_var(--hero-primary-glow)] transition-all duration-300 hover:scale-105 hover:shadow-[0_0_24px_var(--hero-primary-glow)] hover:brightness-110 sm:inline-flex"
              style={{
                background:
                  "linear-gradient(90deg, #ff4fa3 0%, #8b5cf6 55%, #38bdf8 100%)",
              }}
            >
              <StartDCAIcon className="h-4 w-4 shrink-0 text-white" />
              Start DCA
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
