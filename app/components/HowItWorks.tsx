import { RevealOnScroll } from "./RevealOnScroll";
import { LottieSection } from "./LottieSection";
import { Card3D } from "./Card3D";

const STEPS = [
  { step: 1, title: "Fund DCA + Gas Tank", description: "Deposit DCA capital (e.g. USDC) for your recurring buys and top up the Gas Tank on that network to cover execution costs. Each chain has its own Gas Tank and configurable gas unit.", theme: "mint" as const },
  { step: 2, title: "Set plan & token", description: "Choose the token to buy, frequency (e.g. daily or weekly), and whether to use auto-execution (fixed daily window) or run executions manually whenever you want.", theme: "lavender" as const },
  { step: 3, title: "Execution on schedule", description: "Auto mode: we run at a fixed time (e.g. 00:00 UTC). Manual: you trigger when ready. Your funds stay in your vault until each execution—non-custodial, predictable.", theme: "peach" as const },
] as const;

export function HowItWorks() {
  return (
    <section id="how-it-works" className="section-pad border-t border-[var(--hero-muted)]/10 relative overflow-hidden bg-transparent">
      <div className="relative z-1 mx-auto max-w-6xl px-4">
        <RevealOnScroll>
          <h2 className="section-title mb-4 text-center">
            How it works
          </h2>
          <p className="section-title-sub mx-auto mb-14 text-center max-w-xl">
            Create a plan, fund it, and we execute on a predictable schedule—no custody, no guesswork on gas. Simple as that. 🚀
          </p>
          <div className="mb-10 flex justify-center">
            <LottieSection name="howitworks" size={120} />
          </div>
        </RevealOnScroll>
        <RevealOnScroll className="reveal-stagger">
          <div className="grid gap-8 md:grid-cols-3 md:gap-6">
            {STEPS.map((item) => (
              <div key={item.step} className="reveal-stagger-item">
                <Card3D>
                  <div className={`landing-card-sweet landing-card-${item.theme} h-full p-6 text-center`}>
                    <span
                      className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full text-xl font-bold text-white shadow-md"
                      style={{ backgroundColor: "var(--hero-primary)" }}
                    >
                      {item.step}
                    </span>
                    <h3 className="mb-2 font-semibold">{item.title}</h3>
                    <p className="text-sm leading-relaxed opacity-90">{item.description}</p>
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

