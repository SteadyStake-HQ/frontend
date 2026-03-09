import type { ReactNode } from "react";
import { RevealOnScroll } from "./RevealOnScroll";

const SOCIAL = [
  {
    label: "X",
    href: "https://x.com/steadystake_hq",
    color: "hover:text-[var(--foreground)]",
    bgHover: "hover:bg-[var(--hero-muted)]/15",
  },
  {
    label: "Discord",
    href: "https://discord.gg/yPpW8cJPmt",
    color: "hover:text-[#5865f2]",
    bgHover: "hover:bg-[#5865f2]/15",
  },
  {
    label: "Telegram",
    href: "https://t.me/+zsH_JP-eaDcxZTVh",
    color: "hover:text-[#26a5e4]",
    bgHover: "hover:bg-[#26a5e4]/15",
  },
  {
    label: "Notion",
    href: "https://drive.google.com/file/d/1RJNWHbnwKXcuXThmmcbTm13E88dhG5SO/view?usp=sharing",
    color: "hover:text-[#000000] dark:hover:text-[#ffffff]",
    bgHover: "hover:bg-[#000000]/15 dark:hover:bg-white/15",
  },
  // {
  //   label: "GitHub",
  //   href: "https://github.com/steadystake",
  //   color: "hover:text-[var(--foreground)]",
  //   bgHover: "hover:bg-[var(--hero-muted)]/15",
  // },
] as const;

const ICONS: Record<(typeof SOCIAL)[number]["label"], ReactNode> = {
  X: (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  ),
  Discord: (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  ),
  Telegram: (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  ),
  // GitHub: (
  //   <svg
  //     className="h-5 w-5"
  //     viewBox="0 0 24 24"
  //     fill="currentColor"
  //     aria-hidden
  //   >
  //     <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
  //   </svg>
  // ),
  Notion: (
    <svg
      className="h-5 w-5"
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

export function Footer() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "SteadyStake",
    description: "Multi-chain non-custodial DCA. Set a plan, fund DCA + Gas Tank, we execute on schedule. BNB Chain, Base, Polygon, Kava.",
    url: "https://steadystake.org",
    logo: "https://steadystake.org/Logo.jpeg",
    sameAs: [
      "https://x.com/steadystake_hq",
      "https://discord.gg/yPpW8cJPmt",
      "https://t.me/+zsH_JP-eaDcxZTVh",
      "https://drive.google.com/file/d/1RJNWHbnwKXcuXThmmcbTm13E88dhG5SO/view?usp=sharing",
    ],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "Customer Support",
      availableLanguage: "English",
    },
  };

  return (
    <footer className="footer-pattern-bg relative overflow-hidden border-t border-[var(--hero-muted)]/10 bg-[#101014]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="relative mx-auto max-w-6xl px-4 py-14">
        <RevealOnScroll>
          <div className="flex flex-col items-center justify-between gap-8 md:flex-row">
            <div className="text-center md:text-left">
              <span
                className="text-xl font-bold"
                style={{
                  background:
                    "linear-gradient(135deg, var(--hero-primary), var(--hero-secondary))",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                SteadyStake
              </span>
              <p className="mt-2 text-sm text-[var(--hero-muted)]">
                Non-custodial DCA across BNB Chain, Base, Polygon & Kava
              </p>
              <p className="mt-1 text-xs text-[var(--hero-muted)]/80">
                Set a plan. Fund DCA + Gas Tank. We execute on schedule.
              </p>
            </div>
            <nav className="flex items-center gap-2" aria-label="Social links">
              {SOCIAL.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex h-11 w-11 items-center justify-center rounded-xl text-[var(--hero-muted)] transition-all duration-300 ${item.color} ${item.bgHover}`}
                  title={item.label}
                >
                  {ICONS[item.label]}
                </a>
              ))}
            </nav>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-[var(--hero-muted)]/15 pt-8">
            <p className="text-center text-xs text-[var(--hero-muted)]">
              © {new Date().getFullYear()} SteadyStake. Non-custodial DCA across chains—your keys, your coins.
            </p>
          </div>
        </RevealOnScroll>
      </div>
    </footer>
  );
}

