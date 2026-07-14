import type { CSSProperties } from "react";
import { RevealOnScroll } from "./RevealOnScroll";
import { Card3D } from "./Card3D";

/** Expanding-reach graphic: rings radiate out from the product we run today. */
function Horizon() {
  const CX = 300;
  const CY = 210;
  const RINGS = [60, 110, 165, 220];

  const arc = (r: number) => `M${CX - r},${CY} A${r},${r} 0 0 1 ${CX + r},${CY}`;

  return (
    <svg viewBox="0 0 600 250" className="vs-horizon" role="img" aria-label="Expanding reach: SteadyStake grows outward from four live chains toward being the default savings layer for crypto.">
      <line className="vs-ground" x1="40" y1={CY} x2="560" y2={CY} />

      {RINGS.map((r, i) => (
        <path
          key={r}
          className="vs-ring"
          d={arc(r)}
          style={{ animationDelay: `${0.3 + i * 0.22}s`, opacity: 1 - i * 0.18 }}
        />
      ))}

      {/* Reach keeps pushing outward */}
      {[0, 1].map((n) => (
        <path
          key={`pulse-${n}`}
          className="vs-pulse"
          d={arc(60)}
          style={{ animationDelay: `${n * 2}s` }}
        />
      ))}

      {/* The core: what runs today */}
      <circle className="vs-core-glow" cx={CX} cy={CY} r="26" />
      <circle className="vs-core" cx={CX} cy={CY} r="16" />
      <path
        className="vs-star"
        d={`M${CX} ${CY - 9} L${CX + 2.6} ${CY - 2.6} L${CX + 9} ${CY} L${CX + 2.6} ${CY + 2.6} L${CX} ${CY + 9} L${CX - 2.6} ${CY + 2.6} L${CX - 9} ${CY} L${CX - 2.6} ${CY - 2.6} Z`}
      />
    </svg>
  );
}

const STAGES = [
  {
    key: "today",
    step: "01",
    label: "Today",
    status: "Live now",
    text: "Non-custodial DCA, executing on 4 chains.",
  },
  {
    key: "next",
    step: "02",
    label: "Expand",
    status: "Next horizon",
    text: "Every EVM chain, embedded in wallets and DeFi apps.",
  },
  {
    key: "star",
    step: "03",
    label: "North star",
    status: "The destination",
    text: "The default savings layer for crypto.",
  },
] as const;

function StageIcon({ stage }: { stage: (typeof STAGES)[number]["key"] }) {
  if (stage === "today") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 12.5 9.2 17 19 7" />
      </svg>
    );
  }

  if (stage === "next") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 17 17 5M8 5h9v9" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m12 3 2.15 6.85L21 12l-6.85 2.15L12 21l-2.15-6.85L3 12l6.85-2.15L12 3Z" />
    </svg>
  );
}

const PILLARS = [
  {
    theme: "mint" as const,
    icon: "🏦",
    title: "Savings, not trading",
    body: "Accumulate on a schedule instead of reacting to charts — with no custody risk.",
  },
  {
    theme: "lavender" as const,
    icon: "🧠",
    title: "AI strategy assistants",
    body: "Guided plans that adapt allocation and frequency to you, not a one-size DCA box.",
  },
  {
    theme: "sky" as const,
    icon: "🔗",
    title: "Everywhere liquidity is",
    body: "Chain-agnostic contracts — a new network is a deployment, not a rewrite.",
  },
  {
    theme: "peach" as const,
    icon: "🎟️",
    title: "Token-aligned users",
    body: "Free auto-execution tickets, discounted gas, and premium AI for holders.",
  },
] as const;

export function Vision() {
  return (
    <section
      id="vision"
      className="section-pad border-t border-[var(--hero-muted)]/10 relative overflow-hidden bg-transparent"
    >
      <div className="relative z-1 mx-auto max-w-6xl px-4">
        <RevealOnScroll>
          <p className="ps-eyebrow mx-auto mb-4">Long-term vision</p>
          <h2 className="section-title mb-4 text-center">
            Make saving in crypto as boring as a standing order.
          </h2>
          <p className="section-title-sub mx-auto mb-10 text-center">
            Set it once, forget it, and let it run — on any chain, without ever handing over your keys.
          </p>
        </RevealOnScroll>

        <RevealOnScroll>
          <Horizon />

          <div className="vs-journey">
            <div className="vs-flow-rail" aria-hidden="true">
              <span className="vs-flow-beam" />
              <span className="vs-flow-packet" />
            </div>

            <ol className="vs-stages" aria-label="SteadyStake product journey">
              {STAGES.map((s, index) => (
                <li
                  key={s.key}
                  className={`vs-stage vs-stage-${s.key}`}
                  style={
                    {
                      "--stage-enter-delay": `${index * 0.24}s`,
                      "--stage-flow-delay": `${index * 2.4}s`,
                    } as CSSProperties
                  }
                >
                  <div className="vs-stage-node" aria-hidden="true">
                    <span className="vs-stage-node-ring" />
                    <span className="vs-stage-icon">
                      <StageIcon stage={s.key} />
                    </span>
                  </div>

                  <div className="vs-stage-card">
                    <div className="vs-stage-meta">
                      <span className="vs-stage-step">{s.step}</span>
                      <span className="vs-stage-status">{s.status}</span>
                    </div>
                    <span className="vs-stage-label">{s.label}</span>
                    <span className="vs-stage-text">{s.text}</span>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </RevealOnScroll>

        <RevealOnScroll className="reveal-stagger">
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {PILLARS.map((p) => (
              <div key={p.title} className="reveal-stagger-item flex">
                <Card3D className="flex-1">
                  <div className={`landing-card-sweet landing-card-${p.theme} vs-pillar h-full p-6`}>
                    <span className="landing-tile" aria-hidden>
                      {p.icon}
                    </span>
                    <h3 className="vs-pillar-title">{p.title}</h3>
                    <p className="vs-pillar-body">{p.body}</p>
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
