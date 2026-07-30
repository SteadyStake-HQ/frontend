import { RevealOnScroll } from "./RevealOnScroll";
import { Card3D } from "./Card3D";

const MILESTONES = [
  {
    phase: "Phase 1",
    timeframe: "Done",
    icon: "🚀",
    theme: "mint" as const,
    status: "done" as const,
    statusLabel: "Shipped",
    title: "Mainnet & reliability",
    goal: "Make execution boring and dependable.",
    items: [
      "Contracts live & verified on mainnet",
      "Relayer executing on mainnet",
      "Gas charged at cost, from receipts",
      "Admin holds, gates & network status",
    ],
  },
  {
    phase: "Phase 2",
    timeframe: "0–3 months",
    icon: "⚙️",
    theme: "lavender" as const,
    status: "now" as const,
    statusLabel: "In progress",
    title: "Public launch",
    goal: "Open the doors and grow the base.",
    items: [
      "1 free auto plan per network",
      "Paid extra auto plans",
      "Deeper execution history & exports",
      "Uptime and failure alerting",
    ],
  },
  {
    phase: "Phase 3",
    timeframe: "3–8 months",
    icon: "🤝",
    theme: "sky" as const,
    status: "next" as const,
    statusLabel: "Up next",
    title: "Expansion",
    goal: "Be where the users and liquidity already are.",
    items: ["More high-demand chains", "Membership tiers + gas discounts", "Wallet & DeFi integrations", "Plan templates"],
  },
  {
    phase: "Phase 4",
    timeframe: "8–12 months",
    icon: "🤖",
    theme: "peach" as const,
    status: "later" as const,
    statusLabel: "Planned",
    title: "AI & token",
    goal: "Turn DCA into a guided, rewarded system.",
    items: ["AI strategy assistants", "Token: free auto tickets", "Discounted gas for holders", "Multi-executor redundancy"],
  },
] as const;

export function Roadmap() {
  return (
    <section
      id="roadmap"
      className="section-pad border-t border-[var(--hero-muted)]/10 relative overflow-hidden bg-transparent"
    >
      <div className="relative z-10 mx-auto max-w-6xl px-4">
        <RevealOnScroll>
          <p className="ps-eyebrow mx-auto mb-4">Roadmap</p>
          <h2 className="section-title mb-4 text-center">From live mainnet to AI &amp; token utility</h2>
          <p className="section-title-sub mx-auto mb-12 text-center">
            Four phases, and the first one is already behind us. Boring reliability came first on purpose —
            everything after it is built on contracts that are executing today.
          </p>
        </RevealOnScroll>

        <RevealOnScroll className="reveal-stagger">
          <div className="rm-track grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {MILESTONES.map((m, i) => (
              <div key={m.phase} className="reveal-stagger-item flex flex-col">
                {/* Rail segment: on xl the four segments line up into one continuous timeline */}
                <div className={`rm-rail rm-rail-${m.status}`} aria-hidden>
                  <span className="rm-rail-line" style={{ animationDelay: `${i * 0.12}s` }} />
                  <span className="rm-rail-dot">
                    {m.status === "now" && <span className="rm-rail-ping" />}
                  </span>
                </div>

                <p className={`rm-status rm-status-${m.status}`}>
                  {m.status === "now" && <span className="rm-status-live" aria-hidden />}
                  {m.statusLabel}
                </p>

                <Card3D className="flex-1">
                  <div className={`landing-card-sweet landing-card-${m.theme} rm-card h-full p-6`}>
                    <div className="rm-card-head">
                      <span className="landing-tile" aria-hidden>
                        {m.icon}
                      </span>
                      <div>
                        <h3 className="rm-title">{m.title}</h3>
                        <p className="rm-meta">
                          {m.phase} · {m.timeframe}
                        </p>
                      </div>
                    </div>

                    <p className="rm-goal">{m.goal}</p>

                    <ul className="rm-chips">
                      {m.items.map((item) => (
                        <li key={item} className="rm-chip">
                          {item}
                        </li>
                      ))}
                    </ul>
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
