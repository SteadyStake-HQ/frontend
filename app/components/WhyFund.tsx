import { RevealOnScroll } from "./RevealOnScroll";
import { LottieSection } from "./LottieSection";
import { Card3D } from "./Card3D";

const REASONS = [
  { title: "Predictable costs", text: "Gas Tank = gas unit × executions. Example: 200 runs at $0.01/run on BSC = $2. No custody, no surprise fees.", theme: "mint" as const },
  { title: "Ecosystem growth", text: "Consistent buying pressure on ecosystem tokens; DCA creates sticky, long-term users across chains.", theme: "lavender" as const },
  { title: "Partnership potential", text: "Integrates with every token project. Wallets and DeFi apps can embed recurring buy as a native feature.", theme: "peach" as const },
  { title: "Monetization", text: "Extra auto-executed plans per network; future VIP gas discounts and premium AI assistants.", theme: "sky" as const },
] as const;

export function WhyFund() {
  return (
    <section className="section-pad border-t border-[var(--hero-muted)]/10 relative overflow-hidden bg-transparent">
      
      <div className="relative z-1 mx-auto max-w-6xl px-4">
        <RevealOnScroll>
          <h2 className="mb-2 text-center" style={{
            fontSize: 'clamp(2.5rem, 6vw, 3.5rem)',
            fontWeight: 900,
            background: 'linear-gradient(135deg, var(--hero-primary), var(--hero-secondary), var(--hero-accent))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            letterSpacing: '-0.02em',
          }}>
            Economics & value
          </h2>
          <p className="section-title-sub mx-auto mb-12 max-w-2xl text-center text-base font-semibold md:text-lg">
            Clear economics: you pay for DCA capital (your buys) and a prepaid Gas Tank (execution cost per chain). We never take custody—automation stays predictable and scalable. 📊
          </p>
          <div className="mb-12 flex justify-center">
            <LottieSection name="whyfund" size={140} />
          </div>
        </RevealOnScroll>
        <RevealOnScroll className="reveal-stagger">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 items-stretch">
            {REASONS.map((r) => (
              <div key={r.title} className="reveal-stagger-item flex">
                <Card3D className="flex-1 min-h-[280px]">
                  <div className={`landing-card-sweet landing-card-${r.theme} h-full min-h-[280px] p-8 flex flex-col`}>
                    <h3 className="mb-3 text-xl font-bold">{r.title}</h3>
                    <p className="text-base leading-relaxed opacity-90">{r.text}</p>
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

