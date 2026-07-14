import { RevealOnScroll } from "./RevealOnScroll";
import { LottieSection } from "./LottieSection";
import { Card3D } from "./Card3D";

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
            Live on four networks—built for many more
          </h2>
          <p className="section-title-sub mx-auto mb-12 text-center max-w-2xl">
            SteadyStake is deployed and executing today on{" "}
            <strong className="font-semibold text-[var(--foreground)]">BNB Chain, Base, Polygon, and Kava</strong>. The contracts and the executor are chain-agnostic, so a new network is a deployment—not a rewrite. 🌐
          </p>
          <div className="mb-8 flex justify-center">
            <LottieSection name="whybase" size={120} />
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
