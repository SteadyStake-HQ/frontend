import { RevealOnScroll } from "./RevealOnScroll";
import { LottieSection } from "./LottieSection";
import { Card3D } from "./Card3D";

/**
 * BOT Chain is the partner network, so it gets its own full-width card above the
 * grid rather than a fifth tile inside it — the hierarchy is the branding.
 */
const LEAD_NETWORK = {
  name: "BOT Chain",
  iconUrl: "/bot.svg",
  kicker: "Partner network",
  blurb:
    "SteadyStake is building with BOT Chain: sub-second blocks, near-zero fees, and an executor tuned for its Parlia consensus — the smoothest home for recurring, non-custodial DCA.",
  facts: [
    { label: "~0.75s", detail: "block time" },
    { label: "BDEX V2", detail: "swap routing" },
    { label: "Native BOT", detail: "gas tank" },
  ],
  href: "https://botchain.ai",
} as const;

const NETWORKS = [
  { name: "BNB Chain", iconUrl: "/bsc.svg", theme: "mint" as const },
  { name: "Base", iconUrl: "/base.svg", theme: "sky" as const },
  { name: "Polygon", iconUrl: "/polygon.svg", theme: "lavender" as const },
  { name: "Kava", iconUrl: "/kava.svg", theme: "peach" as const },
] as const;

export function WhyBase() {
  return (
    <section id="networks" className="section-pad border-t border-[var(--hero-muted)]/10 relative overflow-hidden bg-transparent">
      <div className="relative z-1 mx-auto max-w-6xl px-4">
        <RevealOnScroll>
          <h2 className="section-title mb-4 text-center">
            Powered by BOT Chain—live on five networks
          </h2>
          <p className="section-title-sub mx-auto mb-12 text-center max-w-2xl">
            SteadyStake is building alongside{" "}
            <strong className="nw-lead-inline">BOT Chain</strong>, and also executes
            today on{" "}
            <strong className="font-semibold text-[var(--foreground)]">BNB Chain, Base, Polygon, and Kava</strong>. The contracts and the executor are chain-agnostic, so a new network is a deployment—not a rewrite. 🌐
          </p>
          <div className="mb-8 flex justify-center">
            <LottieSection name="whybase" size={120} />
          </div>
        </RevealOnScroll>

        <RevealOnScroll>
          <div className="landing-card-sweet landing-card-bot nw-lead mb-6">
            <div className="nw-lead-visual" aria-hidden="true">
              <span className="nw-lead-glow" />
              <span className="nw-lead-ring" />
            </div>

            <span className="nw-lead-mark">
              <img
                src={LEAD_NETWORK.iconUrl}
                alt={LEAD_NETWORK.name}
                className="h-12 w-12 object-contain"
                width={48}
                height={48}
              />
            </span>

            <div className="nw-lead-copy">
              <span className="nw-lead-kicker">
                <span className="nw-live-dot" aria-hidden>
                  <span className="nw-live-ping" />
                </span>
                {LEAD_NETWORK.kicker}
              </span>
              <h3 className="nw-lead-name">{LEAD_NETWORK.name}</h3>
              <p className="nw-lead-blurb">{LEAD_NETWORK.blurb}</p>
              <ul className="nw-lead-facts">
                {LEAD_NETWORK.facts.map((fact) => (
                  <li key={fact.label} className="nw-lead-fact">
                    <strong>{fact.label}</strong>
                    <span>{fact.detail}</span>
                  </li>
                ))}
              </ul>
            </div>

            <a
              href={LEAD_NETWORK.href}
              target="_blank"
              rel="noopener noreferrer"
              className="ss-btn ss-btn-primary ss-btn-pill nw-lead-cta"
            >
              <span>Explore BOT Chain</span>
              <svg
                className="h-[1.05rem] w-[1.05rem]"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M4 10h11M11 6l4 4-4 4" />
              </svg>
            </a>
          </div>
        </RevealOnScroll>

        <RevealOnScroll className="reveal-stagger">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {NETWORKS.map((item) => (
              <div key={item.name} className="reveal-stagger-item">
                <Card3D>
                  <div className={`landing-card-sweet landing-card-${item.theme} nw-card h-full p-6`}>
                    <span className="nw-logo">
                      <img
                        src={item.iconUrl}
                        alt={item.name}
                        className="h-7 w-7 object-contain"
                        width={28}
                        height={28}
                      />
                    </span>
                    <h3 className="nw-name">{item.name}</h3>
                    <span className="nw-live">
                      <span className="nw-live-dot" aria-hidden>
                        <span className="nw-live-ping" />
                      </span>
                      Live
                    </span>
                  </div>
                </Card3D>
              </div>
            ))}
          </div>
        </RevealOnScroll>
        <RevealOnScroll>
          <div className="landing-card-sweet landing-card-lavender nw-cta mt-6">
            <div className="nw-cta-visual" aria-hidden="true">
              <span className="nw-cta-grid" />
              <span className="nw-cta-orb nw-cta-orb-one" />
              <span className="nw-cta-orb nw-cta-orb-two" />
              <span className="nw-cta-scan" />
            </div>

            <div className="nw-cta-copy">
              <span className="nw-cta-kicker">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="2.5" />
                  <path d="M4.5 8.2a8.2 8.2 0 0 1 15 0M4.5 15.8a8.2 8.2 0 0 0 15 0M8.2 4.5a8.2 8.2 0 0 0 0 15M15.8 4.5a8.2 8.2 0 0 1 0 15" />
                </svg>
                Expand the network
              </span>
              <h3 className="nw-cta-title">Want SteadyStake on your chain?</h3>
              <p className="nw-cta-body">
                Any EVM network with a DEX router can be supported. If your ecosystem wants recurring, non-custodial DCA for its users, we can be live on it—talk to us about backing a deployment.
              </p>
            </div>
            <a
              href="https://telegram.me/+zsH_JP-eaDcxZTVh"
              target="_blank"
              rel="noopener noreferrer"
              className="ss-btn ss-btn-primary ss-btn-pill self-start"
            >
              <span>Get in touch</span>
              <svg
                className="h-[1.05rem] w-[1.05rem]"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M4 10h11M11 6l4 4-4 4" />
              </svg>
            </a>
          </div>
        </RevealOnScroll>
      </div>
    </section>
  );
}
