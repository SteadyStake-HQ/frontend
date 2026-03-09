import { RevealOnScroll } from "./RevealOnScroll";
import { LottieSection } from "./LottieSection";
import { Card3D } from "./Card3D";

const BULLETS = [
  { text: "Become the default automated savings and recurring deployment layer for crypto across chains.", theme: "mint" as const },
  { text: "Set-and-forget: anyone can accumulate assets predictably without custody risk or manual effort.", theme: "lavender" as const },
  { text: "AI strategy assistants turn DCA from a simple recurring buy into a guided, personalized system.", theme: "peach" as const },
  { text: "Token-based benefits align users with the protocol: free auto tickets, discounted gas, premium AI.", theme: "sky" as const },
] as const;

export function Vision() {
  return (
    <section className="section-pad border-t border-[var(--hero-muted)]/10 relative overflow-hidden bg-transparent">
      <div className="relative z-1 mx-auto max-w-6xl px-4">
        <RevealOnScroll>
          <h2 className="section-title mb-4 text-center">
            Long-term vision
          </h2>
          <p className="section-title-sub mx-auto mb-8 max-w-2xl text-center">
            The long-term goal: a consistent set-and-forget experience wherever liquidity and users are—with AI guidance and token utility to make DCA smarter and more rewarding. 🎯
          </p>
          <div className="mb-8 flex justify-center">
            <LottieSection name="vision" size={120} />
          </div>
        </RevealOnScroll>
        <RevealOnScroll className="reveal-stagger">
          <ul className="mx-auto flex max-w-2xl flex-col gap-4">
            {BULLETS.map((item, i) => (
              <li key={i} className="reveal-stagger-item">
                <Card3D>
                  <div className={`landing-card-sweet landing-card-${item.theme} flex items-center gap-3 py-4 px-5`}>
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-current opacity-80" />
                    <span className="font-medium">{item.text}</span>
                  </div>
                </Card3D>
              </li>
            ))}
          </ul>
        </RevealOnScroll>
      </div>
    </section>
  );
}

