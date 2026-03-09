import { RevealOnScroll } from "./RevealOnScroll";
import { LottieSection } from "./LottieSection";
import { Card3D } from "./Card3D";

export function ProblemSolution() {
  return (
    <section id="problem" className="section-pad border-t border-[var(--hero-muted)]/10 relative overflow-hidden bg-transparent">
      <div className="relative z-1 mx-auto max-w-6xl px-4">
        <RevealOnScroll className="reveal-stagger">
          <div className="mb-10 flex justify-center">
            <LottieSection name="problem" size={120} />
          </div>
          <div className="grid gap-12 md:grid-cols-2 md:gap-16">
            {/* Problem */}
            <div className="reveal-stagger-item">
            <h2 className="section-title mb-4">
              The problem
            </h2>
            <p className="mb-6 text-[var(--hero-muted)] leading-relaxed text-base md:text-lg">
              Crypto is still dominated by <strong className="text-[var(--foreground)]">manual execution and emotional timing</strong>. Even users who want to invest long-term skip buys, chase pumps, or stop during drawdowns—because there’s no simple, consistent automation they can trust.
            </p>
            <ul className="space-y-3 text-[var(--hero-muted)]">
              <li className="flex items-start gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--hero-primary)]" />
                <span>Most automation lives on centralized exchanges—custody risk, account risk, opaque execution.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--hero-primary)]" />
                <span>DeFi options are fragmented and unreliable: multiple chains, repeat steps every time, execution on you.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--hero-primary)]" />
                <span>Execution reliability, gas unpredictability, and multi-chain complexity make “set-and-forget” rare.</span>
              </li>
            </ul>
            </div>

            {/* Solution */}
            <div className="reveal-stagger-item">
            <h2 className="section-title mb-4">
              Our solution
            </h2>
            <p className="mb-6 text-[var(--hero-muted)] leading-relaxed text-base md:text-lg">
              A <strong className="text-[var(--foreground)]">non-custodial, multi-chain DCA</strong> system. Create a plan, fund DCA capital + a prepaid Gas Tank per network—we execute on a predictable schedule. Your funds stay on-chain, under your control. 💎
            </p>
            <ol className="space-y-4">
              {[
                { text: "Fund two parts: DCA capital (for buys) + Gas Tank (execution cost per chain).", theme: "mint" as const },
                { text: "Choose token, frequency, and auto or manual execution.", theme: "lavender" as const },
                { text: "Daily fixed window (e.g. 00:00 UTC) or manual—reliable, budgetable automation.", theme: "peach" as const },
              ].map((step, i) => (
                <li key={i} className="reveal-stagger-item">
                  <Card3D>
                    <div className={`landing-card-sweet landing-card-${step.theme} flex items-center gap-4 p-5`}>
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white shadow-md"
                        style={{ backgroundColor: "var(--hero-primary)" }}
                      >
                        {i + 1}
                      </span>
                      <span className="font-medium">{step.text}</span>
                    </div>
                  </Card3D>
                </li>
              ))}
            </ol>
            <p className="mt-6 text-sm font-medium text-[var(--hero-primary)]">
              Core differentiator: prepaid gas model and reliable auto-execution—so you know exactly what automation costs.
            </p>
            </div>
          </div>
        </RevealOnScroll>
      </div>
    </section>
  );
}

