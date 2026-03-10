"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { CustomConnectButton } from "./CustomConnectButton";
import { Card3D } from "./Card3D";
import { useHeroStats } from "@/app/hooks/useHeroStats";

const HERO_STAT_THEMES = ["mint", "lavender", "peach", "sky"] as const;
const AMBIENT_PARTICLE_COUNT = 80;
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

function isStatGrown(
  kind: "activeUsers" | "totalValue" | "avgReturn" | "successRate",
  stats: ReturnType<typeof useHeroStats>
): boolean {
  switch (kind) {
    case "activeUsers":
      return stats.activeUsers > 0;
    case "totalValue":
      return stats.totalValueUsd > 0;
    case "avgReturn":
      return stats.avgReturnPercent > 0;
    case "successRate":
      return stats.successRatePercent > 0;
    default:
      return false;
  }
}

export default function HeroSection() {
  const stats = useHeroStats();
  const { isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);
  const heroRef = useRef<HTMLElement | null>(null);
  const interactionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  const ambientParticles = useMemo(
    () =>
      Array.from({ length: AMBIENT_PARTICLE_COUNT }, (_, i) => {
        const seedA = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
        const seedB = Math.abs(Math.sin((i + 7) * 78.233) * 9623.1234) % 1;
        const seedC = Math.abs(Math.sin((i + 21) * 45.164) * 12345.6789) % 1;

        return {
          id: i,
          left: `${toFixedString(seedA * 100, 4)}%`,
          top: `${toFixedString(seedB * 100, 4)}%`,
          sizePx: `${toFixedString(1 + seedC * 3, 5)}px`,
          durationSec: `${toFixedString(10 + seedB * 10, 4)}s`,
          delaySec: `${toFixedString(seedA * 5, 6)}s`,
          opacity: toFixedString(0.1 + seedC * 0.3, 6),
        };
      }),
    []
  );

  useEffect(() => {
    const hero = heroRef.current;
    const interactionLayer = interactionRef.current;
    if (!hero || !interactionLayer) return;

    const shouldReduceMotion =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (shouldReduceMotion) return;

    let lastBurst = 0;

    const onPointerMove = (event: PointerEvent) => {
      const bounds = hero.getBoundingClientRect();
      const x = event.clientX - bounds.left;
      const y = event.clientY - bounds.top;
      const rx = x / bounds.width - 0.5;
      const ry = y / bounds.height - 0.5;

      hero.style.setProperty("--hero-shift-x", `${rx * 18}px`);
      hero.style.setProperty("--hero-shift-y", `${ry * 14}px`);

      const now = performance.now();
      if (now - lastBurst < 36) return;
      lastBurst = now;

      const particle = document.createElement("span");
      particle.className = "hero-cursor-particle";
      particle.style.left = `${(x / bounds.width) * 100}%`;
      particle.style.top = `${(y / bounds.height) * 100}%`;
      particle.style.width = `${2 + Math.random() * 4}px`;
      particle.style.height = particle.style.width;
      particle.style.setProperty("--burst-dx", `${(Math.random() * 10 - 5).toFixed(2)}%`);
      particle.style.setProperty("--burst-dy", `${(Math.random() * 10 - 5).toFixed(2)}%`);
      interactionLayer.appendChild(particle);

      window.setTimeout(() => particle.remove(), 2000);
    };

    const onPointerLeave = () => {
      hero.style.setProperty("--hero-shift-x", "0px");
      hero.style.setProperty("--hero-shift-y", "0px");
    };

    hero.addEventListener("pointermove", onPointerMove);
    hero.addEventListener("pointerleave", onPointerLeave);

    return () => {
      hero.removeEventListener("pointermove", onPointerMove);
      hero.removeEventListener("pointerleave", onPointerLeave);
      interactionLayer.replaceChildren();
    };
  }, []);

  const animatedUsers = useCountUp(stats.activeUsers, 2000, stats.activeUsers > 0);
  const visibleStats = useMemo(() => {
    const list: Array<{
      key: string;
      label: string;
      color: string;
      render: () => React.ReactNode;
    }> = [];

    if (isStatGrown("activeUsers", stats)) {
      list.push({
        key: "activeUsers",
        label: "Active Users",
        color: "var(--hero-primary)",
        render: () => <>{animatedUsers.toLocaleString()}+</>,
      });
    }
    if (isStatGrown("totalValue", stats)) {
      list.push({
        key: "totalValue",
        label: "Total Value",
        color: "var(--hero-secondary)",
        render: () => <>{stats.totalValueFormatted}</>,
      });
    }
    if (isStatGrown("avgReturn", stats)) {
      list.push({
        key: "avgReturn",
        label: "Avg. Return",
        color: "var(--hero-accent)",
        render: () => <>+{stats.avgReturnPercent}%</>,
      });
    }
    if (isStatGrown("successRate", stats)) {
      list.push({
        key: "successRate",
        label: "Success Rate",
        color: "var(--hero-primary)",
        render: () => <>{stats.successRatePercent}%</>,
      });
    }

    return list;
  }, [stats, animatedUsers]);

  return (
    <section
      ref={heroRef}
      className="hero-bg-root relative min-h-screen overflow-hidden bg-[var(--background)]"
    >
      <div className="hero-bg-layer" aria-hidden="true">
        <div className="hero-bg-base" />
        <div className="hero-bg-spheres">
          <span className="hero-bg-orb hero-bg-orb-a" />
          <span className="hero-bg-orb hero-bg-orb-b" />
          <span className="hero-bg-orb hero-bg-orb-c" />
        </div>
        <span className="hero-bg-pulse" />
        <div className="hero-bg-grid" />
        <div className="hero-bg-noise" />
        <div className="hero-bg-particles">
          {ambientParticles.map((particle) => (
            <span
              key={particle.id}
              className="hero-bg-particle"
              style={{
                left: particle.left,
                top: particle.top,
                width: particle.sizePx,
                height: particle.sizePx,
                animationDuration: particle.durationSec,
                animationDelay: particle.delaySec,
                opacity: particle.opacity,
              }}
            />
          ))}
        </div>
        <div ref={interactionRef} className="hero-bg-interaction" />
        <div className="hero-bg-vignette" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col items-center justify-center px-4 py-20 text-center">
        <div className="hero-animate-slide hero-delay-100 mb-8">
          <div
            className="inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium shadow-sm backdrop-blur-sm"
            style={{
              borderColor:
                "color-mix(in srgb, var(--hero-primary) 35%, transparent)",
              backgroundColor:
                "color-mix(in srgb, var(--hero-primary) 12%, transparent)",
              color: "var(--hero-primary)",
            }}
          >
            <span className="relative flex h-2 w-2">
              <span
                className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                style={{ backgroundColor: "var(--hero-primary)" }}
              />
              <span
                className="relative inline-flex h-2 w-2 rounded-full"
                style={{ backgroundColor: "var(--hero-primary)" }}
              />
            </span>
            <strong className="font-semibold text-[var(--foreground)]">
              Live on BNB Chain, Base, Polygon & Kava
            </strong>
          </div>
        </div>

        <h1 className="hero-animate-slide hero-delay-200 mb-6 font-bold leading-tight tracking-tight">
          <span className="hero-gold-title px-10" data-text="SteadyStake">
            SteadyStake
          </span>
          <span className="mt-4 block text-2xl font-medium text-[var(--foreground)] sm:text-3xl md:text-4xl">
            Grow Your Crypto Gently, Daily, and Fully in Your Control
          </span>
        </h1>

        <p className="hero-animate-slide hero-delay-300 mx-auto mb-12 max-w-2xl text-lg font-normal leading-relaxed text-[var(--hero-muted)] md:text-xl">
          Start once and let SteadyStake build your position with calm, scheduled buys
          while you always keep full custody.
        </p>


        <div className="hero-animate-scale hero-delay-400 mb-20 flex flex-col items-center justify-center gap-4 sm:flex-row">
          {mounted && isConnected ? (
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-base font-semibold text-white shadow-md transition-all hover:opacity-95 active:scale-[0.98]"
              style={{
                background:
                  "linear-gradient(90deg, #ff4fa3 0%, #8b5cf6 55%, #38bdf8 100%)",
              }}
            >
              Go to Dashboard
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
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
            />
          )}
        </div>

        {visibleStats.length > 0 && (
          <div className="hero-animate-fade hero-delay-600 flex flex-wrap items-stretch justify-center gap-6 md:gap-8">
            {visibleStats.map((stat, i) => (
              <Card3D
                key={stat.key}
                className="hero-animate-stat min-w-[140px]"
                style={{ animationDelay: `${700 + i * 80}ms` }}
              >
                <div
                  className={`landing-card-sweet landing-card-${HERO_STAT_THEMES[i % HERO_STAT_THEMES.length]} h-full p-6`}
                >
                  <div
                    className="mb-2 font-bold tabular-nums"
                    style={{
                      fontSize: "clamp(1.25rem, 2vw, 1.75rem)",
                    }}
                  >
                    {stat.render()}
                  </div>
                  <div className="text-sm font-medium opacity-90">{stat.label}</div>
                </div>
              </Card3D>
            ))}
          </div>
        )}

        <div className="hero-animate-fade hero-delay-1500 absolute bottom-8 left-1/2 -translate-x-1/2">
          <div className="hero-animate-scroll flex flex-col items-center gap-1 text-[var(--hero-muted)]">
            <span className="text-xs font-medium">Scroll</span>
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
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
      </div>
    </section>
  );
}
