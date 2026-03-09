import { RevealOnScroll } from "./RevealOnScroll";
import { LottieSection } from "./LottieSection";
import { Card3D } from "./Card3D";

const MILESTONES = [
  { phase: "Phase 1", timeframe: "0–2 months", icon: "🚀", theme: "mint" as const, title: "Beta & Reliability", items: ["Complete auto-executor integration and full test stage.", "Onboard 50 beta testers across BNB, Base, Polygon, Kava.", "Harden Gas Tank: deposits, charging accuracy, edge cases.", "Monitoring + alerting for executor uptime and tx failures."] },
  { phase: "Phase 2", timeframe: "2–4 months", icon: "⚙️", theme: "lavender" as const, title: "Public Launch & Scaling", items: ["Open access: 1 auto-executed plan per user per network.", "Paid upgrades for additional auto-executed plans.", "Dedicated executor per network as volume grows.", "Analytics dashboard: execution history, Gas Tank transparency."] },
  { phase: "Phase 3", timeframe: "4–8 months", icon: "🤝", theme: "sky" as const, title: "Expansion & Partnerships", items: ["Deploy to more high-demand networks.", "VIP tiers: discounted gas units, priority execution.", "Integrations with wallets and DeFi apps (recurring buy native).", "Plan templates, guided onboarding, simplified funding."] },
  { phase: "Phase 4", timeframe: "8–12 months", icon: "🤖", theme: "peach" as const, title: "AI Assistants & Token", items: ["Multiple AI Strategy Assistants for plan creation and optimization.", "Native token utility: free auto-exec tickets, discounted gas.", "Premium AI assistance and rewards for DCA into the token.", "Multiple executors per network; strong reliability targets."] },
] as const;

export function Roadmap() {
  return (
    <section
      id="roadmap"
      className="section-pad border-t border-[var(--hero-muted)]/10 relative overflow-hidden bg-transparent"
    >

      <div className="relative z-10 mx-auto max-w-6xl px-4">
        <RevealOnScroll>
          <h2 className="section-title mb-4 text-center">Roadmap</h2>
          <p className="section-title-sub mx-auto mb-14 max-w-xl text-center">
            From beta and reliability to public launch, partnerships, and AI + token utility. We're building something special. 🌟
          </p>
          <div className="mb-10 flex justify-center">
            <LottieSection name="roadmap" size={120} />
          </div>
        </RevealOnScroll>
        <RevealOnScroll className="reveal-stagger">
          <div>
            <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-4 items-stretch">
              {MILESTONES.map((m) => (
                <div key={m.phase} className="reveal-stagger-item flex">
                  <Card3D className="flex-1 min-h-[280px]">
                    <div className={`landing-card-sweet landing-card-${m.theme} h-full min-h-[280px] p-7 flex flex-col`}>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-3xl" aria-hidden>{m.icon}</span>
                        <div>
                          <h3 className="text-lg font-bold">{m.title}</h3>
                          <p className="text-xs font-medium opacity-80">{m.phase} · {m.timeframe}</p>
                        </div>
                      </div>
                      <ul className="space-y-3 mt-4">
                        {m.items.map((item) => (
                          <li key={item} className="flex items-start gap-2 text-sm opacity-90">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-70" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </Card3D>
                </div>
              ))}
            </div>
          </div>
        </RevealOnScroll>
      </div>
    </section>
  );
}

