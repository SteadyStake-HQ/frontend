import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { RevealOnScroll } from "./RevealOnScroll";
import { BackToTop } from "./BackToTop";

const ONE_PAGER =
  "https://drive.google.com/file/d/1RJNWHbnwKXcuXThmmcbTm13E88dhG5SO/view?usp=sharing";

const SOCIAL = [
  {
    label: "X",
    sub: "@_steadystake",
    href: "https://x.com/_steadystake",
    accent: "var(--foreground)",
  },
  {
    label: "Telegram",
    sub: "Join the community",
    href: "https://telegram.me/+zsH_JP-eaDcxZTVh",
    accent: "#26a5e4",
  },
  {
    label: "One-pager",
    sub: "Read the deck",
    href: ONE_PAGER,
    accent: "var(--hero-secondary)",
  },
] as const;

const ICONS: Record<(typeof SOCIAL)[number]["label"], ReactNode> = {
  X: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  ),
  Telegram: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  ),
  "One-pager": (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  ),
};

const CHAINS = [
  { label: "BNB Chain", dot: "#f0b90b" },
  { label: "Base", dot: "#0052ff" },
  { label: "Polygon", dot: "#8247e5" },
  { label: "Kava", dot: "#ff433e" },
] as const;

type FooterLink = { label: string; href: string; external?: boolean };

const COLUMNS: readonly { title: string; links: readonly FooterLink[] }[] = [
  {
    title: "Product",
    links: [
      { label: "The problem", href: "#problem" },
      { label: "Networks", href: "#networks" },
      { label: "How it works", href: "#how-it-works" },
      { label: "Economics", href: "#economics" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Roadmap", href: "#roadmap" },
      { label: "Vision", href: "#vision" },
      { label: "Dashboard", href: "/dashboard" },
      { label: "One-pager", href: ONE_PAGER, external: true },
    ],
  },
];

const BADGES = ["Non-custodial", "Open execution", "Cancel anytime"] as const;

/** Decorative: a steady, flowing pulse line — the DCA rhythm, drawn under the footer. */
function PulseWave() {
  const PATH =
    "M0,78 C110,44 190,104 300,78 C410,52 470,26 600,62 C730,98 790,104 900,68 C1010,32 1100,58 1200,46";
  const BEATS = [
    { cx: 300, cy: 78, delay: "0s" },
    { cx: 600, cy: 62, delay: "0.9s" },
    { cx: 900, cy: 68, delay: "1.8s" },
  ];

  return (
    <svg
      className="ft-wave"
      viewBox="0 0 1200 120"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id="ft-wave-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--hero-primary)" stopOpacity="0" />
          <stop offset="25%" stopColor="var(--hero-primary)" />
          <stop offset="60%" stopColor="var(--hero-secondary)" />
          <stop offset="90%" stopColor="var(--hero-accent)" />
          <stop offset="100%" stopColor="var(--hero-accent)" stopOpacity="0" />
        </linearGradient>
      </defs>

      <path className="ft-wave-ghost" d={PATH} transform="translate(0,14)" />
      <path className="ft-wave-line" d={PATH} />

      {BEATS.map((b) => (
        <g key={b.cx}>
          <circle
            className="ft-wave-ring"
            cx={b.cx}
            cy={b.cy}
            r="6"
            style={{ animationDelay: b.delay }}
          />
          <circle
            className="ft-wave-beat"
            cx={b.cx}
            cy={b.cy}
            r="3.5"
            style={{ animationDelay: b.delay }}
          />
        </g>
      ))}
    </svg>
  );
}

export function Footer() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "SteadyStake",
    description:
      "Multi-chain non-custodial DCA. Set a plan, fund DCA + Gas Tank, we execute on schedule. BNB Chain, Base, Polygon, Kava.",
    url: "https://steadystake.org",
    logo: "https://steadystake.org/logo.png",
    sameAs: [
      "https://x.com/_steadystake",
      "https://telegram.me/+zsH_JP-eaDcxZTVh",
      ONE_PAGER,
    ],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "Customer Support",
      availableLanguage: "English",
    },
  };

  return (
    <footer className="ft-root border-t border-[var(--hero-muted)]/15">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <span className="ft-beam" aria-hidden />
      <div className="ft-layer" aria-hidden>
        <span className="ft-orb ft-orb-a" />
        <span className="ft-orb ft-orb-b" />
        <span className="ft-orb ft-orb-c" />
        <span className="ft-mesh" />
        <PulseWave />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-4 pt-14 pb-8">
        <RevealOnScroll>
          <div className="ft-cta">
            <div>
              <h2 className="ft-cta-title">Ready to stack, steadily?</h2>
              <p className="ft-cta-sub">
                Set a plan, fund your DCA + Gas Tank, and we execute on schedule
                — your keys never leave your wallet.
              </p>
            </div>
            <Link href="/dashboard" className="ss-btn ss-btn-primary self-start">
              <svg
                className="h-4 w-4 shrink-0"
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
              Start your DCA plan
            </Link>
          </div>
        </RevealOnScroll>

        <RevealOnScroll className="reveal-stagger">
          <div className="ft-main">
            <div className="reveal-stagger-item ft-brand">
              <Link href="/" className="hd-brand" aria-label="SteadyStake home">
                <span className="hd-brand-mark" aria-hidden="true">
                  <span className="hd-brand-halo" />
                  <Image
                    src="/logo.png"
                    alt=""
                    width={42}
                    height={40}
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
              <p className="ft-tagline">
                Non-custodial DCA across BNB Chain, Base, Polygon &amp; Kava.
                Set a plan. Fund DCA + Gas Tank. We execute on schedule.
              </p>

              <span className="ft-status">
                <span className="ft-status-dot" />
                Executor live · 4 chains
              </span>

              <ul className="ft-chains">
                {CHAINS.map((c) => (
                  <li
                    key={c.label}
                    className="ft-chain"
                    style={{ "--ft-dot": c.dot } as CSSProperties}
                  >
                    <span className="ft-chain-dot" />
                    {c.label}
                  </li>
                ))}
              </ul>
            </div>

            {COLUMNS.map((col) => (
              <nav
                key={col.title}
                className="reveal-stagger-item ft-col"
                aria-label={col.title}
              >
                <h3 className="ft-col-title">{col.title}</h3>
                <ul className="ft-col-list">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      {link.external ? (
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ft-link"
                        >
                          {link.label}
                        </a>
                      ) : (
                        <Link href={link.href} className="ft-link">
                          {link.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </nav>
            ))}

            <div className="reveal-stagger-item ft-connect">
              <h3 className="ft-col-title">Connect</h3>
              <div className="ft-socials">
                {SOCIAL.map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ft-social"
                    style={{ "--ft-accent": item.accent } as CSSProperties}
                  >
                    <span className="ft-social-icon">{ICONS[item.label]}</span>
                    <span className="ft-social-text">
                      <span className="ft-social-label">{item.label}</span>
                      <span className="ft-social-sub">{item.sub}</span>
                    </span>
                    <svg
                      className="ft-social-arrow h-4 w-4"
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
          </div>
        </RevealOnScroll>

        <div className="ft-bottom">
          <p className="ft-copy">
            © {new Date().getFullYear()} SteadyStake — your keys, your coins.
          </p>

          <ul className="ft-badges">
            {BADGES.map((b) => (
              <li key={b} className="ft-badge">
                <svg
                  className="h-3 w-3 shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="m20 6-11 11-5-5" />
                </svg>
                {b}
              </li>
            ))}
          </ul>

          <BackToTop />
        </div>
      </div>
    </footer>
  );
}
