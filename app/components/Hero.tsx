"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useAccount } from "wagmi";
import { CustomConnectButton } from "./CustomConnectButton";
import { HeroVisual } from "./HeroVisual";
import { useHeroStats } from "@/app/hooks/useHeroStats";

const AMBIENT_MOTE_COUNT = 14;
/** BOT Chain is the partner network — it is named in the badge, the rest are icons only. */
const HERO_LEAD_CHAIN = { name: "BOT Chain", iconUrl: "/bot.svg" } as const;
const HERO_CHAINS = [
  { name: "BNB Chain", iconUrl: "/bsc.svg" },
  { name: "Base", iconUrl: "/base.svg" },
  { name: "Polygon", iconUrl: "/polygon.svg" },
  { name: "Kava", iconUrl: "/kava.svg" },
] as const;

const HERO_TRUST = [
  {
    label: "Non-custodial",
    detail: "Funds stay in your wallet's vault",
    path: "M12 3l7 4v5c0 4.4-3 8.2-7 9-4-.8-7-4.6-7-9V7l7-4z",
  },
  {
    label: "Gas prepaid",
    detail: "Gas Tank covers every scheduled buy",
    path: "M13 2L4 14h6l-1 8 9-12h-6l1-8z",
  },
  {
    label: "Cancel anytime",
    detail: "Pause or withdraw in one transaction",
    path: "M12 8v4l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  },
] as const;

const toFixedString = (value: number, digits: number) => value.toFixed(digits);

function useCountUp(end: number, durationMs = 1800, startOn = true) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!startOn) return;
    const start = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / durationMs, 1);
      const eased = 1 - Math.pow(1 - t, 2.5);
      setCount(Math.round(eased * end));
      if (t < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [end, durationMs, startOn]);

  return count;
}

export default function HeroSection() {
  const stats = useHeroStats();
  const { isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);
  const heroRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  const ambientMotes = useMemo(
    () =>
      Array.from({ length: AMBIENT_MOTE_COUNT }, (_, i) => {
        const seedA = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
        const seedB = Math.abs(Math.sin((i + 7) * 78.233) * 9623.1234) % 1;
        const seedC = Math.abs(Math.sin((i + 21) * 45.164) * 12345.6789) % 1;

        return {
          id: i,
          left: `${toFixedString(seedA * 100, 4)}%`,
          top: `${toFixedString(30 + seedB * 70, 4)}%`,
          sizePx: `${toFixedString(2 + seedC * 2, 5)}px`,
          durationSec: `${toFixedString(18 + seedB * 12, 4)}s`,
          delaySec: `${toFixedString(seedA * 12, 6)}s`,
          opacity: toFixedString(0.18 + seedC * 0.22, 6),
        };
      }),
    []
  );

  // Pointer only nudges CSS variables — the blooms and spotlight ease toward
  // them in CSS, so there is no per-frame JS and no DOM churn.
  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;

    const shouldReduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (shouldReduceMotion) return;

    let frame = 0;

    const onPointerMove = (event: PointerEvent) => {
      if (frame) return;

      frame = requestAnimationFrame(() => {
        frame = 0;
        const bounds = hero.getBoundingClientRect();
        const x = event.clientX - bounds.left;
        const y = event.clientY - bounds.top;
        const rx = x / bounds.width - 0.5;
        const ry = y / bounds.height - 0.5;

        hero.style.setProperty("--hero-shift-x", `${(rx * 14).toFixed(2)}px`);
        hero.style.setProperty("--hero-shift-y", `${(ry * 10).toFixed(2)}px`);
        hero.style.setProperty("--hero-pointer-x", `${(x / bounds.width) * 100}%`);
        hero.style.setProperty(
          "--hero-pointer-y",
          `${(y / bounds.height) * 100}%`
        );
        hero.style.setProperty("--hero-pointer-opacity", "1");
      });
    };

    const onPointerLeave = () => {
      hero.style.setProperty("--hero-shift-x", "0px");
      hero.style.setProperty("--hero-shift-y", "0px");
      hero.style.setProperty("--hero-pointer-opacity", "0");
    };

    hero.addEventListener("pointermove", onPointerMove);
    hero.addEventListener("pointerleave", onPointerLeave);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      hero.removeEventListener("pointermove", onPointerMove);
      hero.removeEventListener("pointerleave", onPointerLeave);
    };
  }, []);

  const animatedUsers = useCountUp(stats.activeUsers, 2000, stats.activeUsers > 0);
  const visibleStats = useMemo(() => {
    const list: Array<{ key: string; label: string; value: string }> = [];

    if (stats.activeUsers > 0) {
      list.push({
        key: "activeUsers",
        label: "Active users",
        value: `${animatedUsers.toLocaleString()}+`,
      });
    }
    if (stats.totalValueUsd > 0) {
      list.push({
        key: "totalValue",
        label: "Total value",
        value: stats.totalValueFormatted,
      });
    }
    if (stats.avgReturnPercent > 0) {
      list.push({
        key: "avgReturn",
        label: "Avg. return",
        value: `+${stats.avgReturnPercent}%`,
      });
    }
    if (stats.successRatePercent > 0) {
      list.push({
        key: "successRate",
        label: "Success rate",
        value: `${stats.successRatePercent}%`,
      });
    }

    return list;
  }, [stats, animatedUsers]);

  return (
    <section
      ref={heroRef}
      id="home"
      className="hero-bg-root relative min-h-screen overflow-hidden bg-[var(--background)]"
    >
      <div className="hero-bg-layer" aria-hidden="true">
        <div className="hero-bg-base" />
        <div className="hero-bg-blooms">
          <span className="hero-bg-orb hero-bg-orb-a" />
          <span className="hero-bg-orb hero-bg-orb-b" />
          <span className="hero-bg-orb hero-bg-orb-c" />
        </div>
        <div className="hero-bg-grid" />
        <div className="hero-bg-motes">
          {ambientMotes.map((mote) => (
            <span
              key={mote.id}
              className="hero-bg-mote"
              style={
                {
                  left: mote.left,
                  top: mote.top,
                  width: mote.sizePx,
                  height: mote.sizePx,
                  animationDuration: mote.durationSec,
                  animationDelay: mote.delaySec,
                  "--mote-opacity": mote.opacity,
                } as CSSProperties
              }
            />
          ))}
        </div>
        <div className="hero-bg-spotlight" />
        <div className="hero-bg-vignette" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center gap-14 px-4 pb-28 pt-28 lg:flex-row lg:items-center lg:gap-12 lg:pb-24">
        <div className="hero-copy flex flex-col items-center text-center lg:items-start lg:text-left">
          <div className="hero-animate-slide hero-delay-100 mb-7">
            <div className="hero-badge">
              <span className="relative flex h-2 w-2">
                <span className="hero-badge-ping" />
                <span className="hero-badge-core" />
              </span>
              <strong className="font-semibold text-[var(--foreground)]">
                Live on
              </strong>
              <span className="hero-badge-lead" title={HERO_LEAD_CHAIN.name}>
                <span className="hero-badge-chain hero-badge-chain-lead">
                  <img
                    src={HERO_LEAD_CHAIN.iconUrl}
                    alt={HERO_LEAD_CHAIN.name}
                    className="h-full w-full object-contain"
                    width={24}
                    height={24}
                  />
                </span>
                <span className="hero-badge-lead-name">{HERO_LEAD_CHAIN.name}</span>
              </span>
              <span className="hero-badge-plus" aria-hidden>
                +
              </span>
              <span className="flex items-center gap-1.5">
                {HERO_CHAINS.map((chain) => (
                  <span key={chain.name} title={chain.name} className="hero-badge-chain">
                    <img
                      src={chain.iconUrl}
                      alt={chain.name}
                      className="h-full w-full object-contain"
                      width={24}
                      height={24}
                    />
                  </span>
                ))}
              </span>
            </div>
          </div>

          <h1 className="hero-animate-slide hero-delay-200 mb-6 font-bold leading-tight tracking-tight">
            <span className="hero-gold-title hero-gold-title-split" data-text="SteadyStake">
              SteadyStake
            </span>
            <span className="hero-headline mt-4 block">
              Grow your crypto{" "}
              <span className="hero-headline-accent">gently, daily</span>, and fully
              in your control
            </span>
          </h1>

          <p className="hero-animate-slide hero-delay-300 mb-9 max-w-xl text-lg font-normal leading-relaxed text-[var(--hero-muted)] md:text-xl">
            Set one plan and SteadyStake keeps building your position with calm,
            scheduled buys — led by our partner{" "}
            <strong className="hero-bot-inline">BOT Chain</strong> and live across
            five networks, with your keys never leaving your hands.
          </p>

          <div className="hero-animate-scale hero-delay-400 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row lg:items-start">
            {mounted && isConnected ? (
              <Link href="/dashboard" className="ss-btn ss-btn-primary ss-btn-lg">
                Go to Dashboard
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              </Link>
            ) : (
              <CustomConnectButton
                label="Start DCA - Connect wallet"
                size="md"
                variant="primary"
                className="ss-btn-lg"
              />
            )}

            <a
              href="#how-it-works"
              className="ss-btn ss-btn-secondary ss-btn-lg ss-btn-nudge-y"
            >
              See how it works
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 14l-7 7m0 0l-7-7"
                />
              </svg>
            </a>
          </div>

          <ul className="hero-animate-fade hero-delay-600 hero-trust">
            {HERO_TRUST.map((item) => (
              <li key={item.label} className="hero-trust-item" title={item.detail}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.path} />
                </svg>
                {item.label}
              </li>
            ))}
          </ul>

          {visibleStats.length > 0 && (
            <div className="hero-animate-fade hero-delay-700 hero-stats">
              {visibleStats.map((stat) => (
                <div key={stat.key} className="hero-stat">
                  <span className="hero-stat-value tabular-nums">{stat.value}</span>
                  <span className="hero-stat-label">{stat.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="hero-animate-rise hero-delay-500 w-full lg:w-[52%]">
          <HeroVisual />
        </div>
      </div>

      <div className="hero-animate-fade hero-delay-1500 absolute bottom-8 left-1/2 -translate-x-1/2">
        <div className="hero-animate-scroll flex flex-col items-center gap-1 text-[var(--hero-muted)]">
          <span className="text-xs font-medium">Scroll</span>
          <svg
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
        </div>
      </div>
    </section>
  );
}
