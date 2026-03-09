import { RevealOnScroll } from "./RevealOnScroll";
import { LottieSection } from "./LottieSection";
import { Card3D } from "./Card3D";

const NETWORKS = [
  { name: "BNB Chain", tvl: "$5.6B", stablecoins: "$13.8B", volume: "$972M/24h", icon: "🟡", theme: "mint" as const },
  { name: "Base", tvl: "$3.9B", stablecoins: "$4.7B", volume: "$1.09B/24h", icon: "🔵", theme: "sky" as const },
  { name: "Polygon", tvl: "$1.1B", stablecoins: "$3.3B", volume: "$238M/24h", icon: "🟣", theme: "lavender" as const },
  { name: "Kava", tvl: "$65M", stablecoins: "$124M", volume: "—", icon: "⚡", theme: "peach" as const },
] as const;

export function WhyBase() {
  return (
    <section id="networks" className="section-pad border-t border-[var(--hero-muted)]/10 relative overflow-hidden bg-transparent">
      <div className="relative z-1 mx-auto max-w-6xl px-4">
        <RevealOnScroll>
          <h2 className="section-title mb-4 text-center">
            Live on four chains
          </h2>
          <p className="section-title-sub mx-auto mb-12 text-center max-w-2xl">
            SteadyStake runs on <strong className="font-semibold text-[var(--foreground)]">BNB Chain, Base, Polygon, and Kava</strong>. Combined, these networks represent ~$22B in stablecoins and strong DEX volume—so your DCA executes where liquidity lives. 🌐
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
                  <div className={`landing-card-sweet landing-card-${item.theme} h-full p-6`}>
                    <span className="mb-3 block text-2xl" aria-hidden>{item.icon}</span>
                    <h3 className="mb-3 font-semibold">{item.name}</h3>
                    <dl className="space-y-1.5 text-sm font-medium opacity-90">
                      <div className="flex justify-between gap-2">
                        <dt>TVL</dt>
                        <dd>{item.tvl}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt>Stablecoins</dt>
                        <dd>{item.stablecoins}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt>DEX vol/24h</dt>
                        <dd>{item.volume}</dd>
                      </div>
                    </dl>
                  </div>
                </Card3D>
              </div>
            ))}
          </div>
        </RevealOnScroll>
      </div>
    </section>
  );
}

