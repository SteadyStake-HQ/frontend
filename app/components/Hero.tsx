"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useAccount } from "wagmi";
import { CustomConnectButton } from "./CustomConnectButton";
import { GatedLink } from "./GatedLink";
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

/**
 * Autumn token presale — the hero's loudest CTA.
 *
 * The window is quoted in UTC to match the presale app, which draws the same
 * fourteen days as a calendar (see PRESALE_START / PRESALE_DAYS in
 * presale/app/SteadyStakeApp.tsx). It runs Aug 20 – Sep 2, so the end of the
 * sale is midnight at the top of Sep 3. Keep the two in step if the dates move.
 */
const PRESALE_URL = "https://presale.steadystake.org";
const PRESALE_START = Date.UTC(2026, 7, 20);
const PRESALE_END = Date.UTC(2026, 8, 3);
const PRESALE_RANGE_LABEL = "Aug 20 – Sep 2, 2026";

type PresalePhase = "upcoming" | "live" | "ended";

/**
 * The sale's phase and its one-line status.
 *
 * Resolved after mount rather than during render: this page is prerendered, so
 * a clock read at render time would bake the build's date into the HTML and be
 * wrong for everyone who loads it later. `status` is null until the effect
 * runs, which keeps the first client paint identical to the server's — the
 * button still carries the date range in the meantime, so the period is never
 * missing, only the countdown beside it.
 */
function usePresaleWindow(): { phase: PresalePhase; status: string | null } {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(tick, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return useMemo(() => {
    if (now === null) return { phase: "upcoming", status: null };
    if (now >= PRESALE_END) return { phase: "ended", status: "Sale closed" };
    if (now >= PRESALE_START) return { phase: "live", status: "Live now" };

    // Floored, like the presale app's own countdown, so both read the same day.
    const days = Math.floor((PRESALE_START - now) / 86_400_000);
    if (days === 0) return { phase: "upcoming", status: "Opens today" };
    if (days === 1) return { phase: "upcoming", status: "Opens in 1 day" };
    return { phase: "upcoming", status: `Opens in ${days} days` };
  }, [now]);
}

/** Community rail under the hero CTAs. `live` gives the pill a pinging dot. */
const HERO_SOCIALS = [
  {
    key: "x",
    label: "X",
    sub: "@_steadystake",
    href: "https://x.com/_steadystake",
    accent: "var(--foreground)",
    live: false,
  },
  {
    key: "telegram",
    label: "Telegram",
    sub: "Join the chat",
    href: "https://t.me/steadystake_org",
    accent: "#26a5e4",
    live: false,
  },
  {
    key: "arena",
    label: "Echo Arena",
    sub: "Play now",
    href: "https://earena.steadystake.org",
    accent: "#a855f7",
    live: true,
  },
] as const;

function SocialGlyph({ name }: { name: (typeof HERO_SOCIALS)[number]["key"] }) {
  if (name === "x") {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    );
  }

  if (name === "telegram") {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
      </svg>
    );
  }

  // Arcade stick — the Play leg of DCA x AI x Play.
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 11h4M8 9v4" />
      <path d="M15 11h.01M17.5 13.5h.01" />
      <path d="M7.5 6.5h9a5.5 5.5 0 0 1 5.4 6.55l-.6 3.2A3.2 3.2 0 0 1 16 17.9L14.6 16H9.4L8 17.9a3.2 3.2 0 0 1-5.7-1.65l-.6-3.2A5.5 5.5 0 0 1 7.5 6.5Z" />
    </svg>
  );
}

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
  const presale = usePresaleWindow();
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
    // Empty string means the hook judged the total too small to headline — see MIN_DISPLAY_USD.
    if (stats.totalValueFormatted) {
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

          {/* Two tiers on purpose: the presale is a dated window that closes,
              so it takes the top line on its own and the standing product CTAs
              sit as a pair beneath it. */}
          <div className="hero-animate-scale hero-delay-400 hero-cta">
            <a
              href={PRESALE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="ss-btn ss-btn-presale hero-presale-cta"
              data-phase={presale.phase}
            >
              <span className="hero-presale-icon" aria-hidden>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z" />
                  <path d="M13 5v2M13 11v2M13 17v2" />
                </svg>
              </span>

              <span className="hero-presale-text">
                <span className="hero-presale-title">Join the Token Presale</span>
                <span className="hero-presale-meta">
                  <span className="hero-presale-dates">{PRESALE_RANGE_LABEL}</span>
                  {presale.status && (
                    <span className="hero-presale-status">
                      {presale.phase === "live" && (
                        <span className="hero-presale-status-dot" aria-hidden />
                      )}
                      {presale.status}
                    </span>
                  )}
                </span>
              </span>

              <svg
                className="hero-presale-arrow"
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
            </a>

            <div className="hero-cta-row">
              {mounted && isConnected ? (
                <GatedLink
                  href="/dashboard"
                  className="ss-btn ss-btn-secondary ss-btn-lg hero-cta-wallet"
                >
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
                </GatedLink>
              ) : (
                <CustomConnectButton
                  label="Start DCA - Connect wallet"
                  size="md"
                  variant="secondary"
                  className="ss-btn-lg hero-cta-wallet"
                />
              )}

              <a
                href="#how-it-works"
                className="ss-btn ss-btn-ghost ss-btn-lg ss-btn-nudge-y"
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
          </div>

          <div className="hero-animate-scale hero-delay-500 hero-social">
            <span className="hero-social-label">Join the community</span>

            <div className="hero-social-list">
              {HERO_SOCIALS.map((item, index) => (
                <a
                  key={item.key}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hero-social-link"
                  style={
                    {
                      "--hs": item.accent,
                      "--hs-delay": `${index * 1.1}s`,
                    } as CSSProperties
                  }
                >
                  <span className="hero-social-icon">
                    <SocialGlyph name={item.key} />
                    {item.live && <span className="hero-social-live" aria-hidden />}
                  </span>
                  <span className="hero-social-text">
                    <span className="hero-social-name">{item.label}</span>
                    <span className="hero-social-sub">{item.sub}</span>
                  </span>
                  <svg
                    className="hero-social-arrow"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M7 17 17 7" />
                    <path d="M7 7h10v10" />
                  </svg>
                </a>
              ))}
            </div>
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
