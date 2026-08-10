import type { CSSProperties } from "react";
import { RevealOnScroll } from "./RevealOnScroll";
import { Card3D } from "./Card3D";

/**
 * The brand triangle, drawn rather than written: three pillars orbiting one
 * core, each fed by a link that keeps flowing. DCA is what runs today, Play is
 * live in Echo Arena, AI switches on with the token — the graphic says that
 * with a dashed link and a status chip, not a paragraph.
 */
const CX = 360;
const CY = 196;

const NODES = [
  { key: "dca", label: "DCA", x: 96, y: 118, accent: "var(--hero-primary)" },
  { key: "ai", label: "AI", x: 624, y: 118, accent: "var(--hero-secondary)" },
  { key: "play", label: "Play", x: 360, y: 336, accent: "var(--hero-accent)" },
] as const;

function NodeGlyph({ node }: { node: (typeof NODES)[number]["key"] }) {
  if (node === "dca") {
    // Stacked buys on a schedule.
    return (
      <g className="eco-glyph">
        <path d="M-11 8v-6M-4 8v-11M3 8v-8M10 8v-14" />
        <path className="eco-glyph-base" d="M-14 11h28" />
      </g>
    );
  }

  if (node === "ai") {
    // A small network firing: a hub and the signals reaching it.
    return (
      <g className="eco-glyph">
        <path d="M0 0V-10M0 0-9 5.5M0 0 9 5.5" />
        <circle cx="0" cy="0" r="3.6" className="eco-glyph-fill" />
        <circle cx="0" cy="-11.5" r="2.6" className="eco-glyph-fill" />
        <circle cx="-10.5" cy="6.5" r="2.6" className="eco-glyph-fill" />
        <circle cx="10.5" cy="6.5" r="2.6" className="eco-glyph-fill" />
      </g>
    );
  }

  // A hull with its echo trailing behind it.
  return (
    <g className="eco-glyph">
      <path d="M0-11 9 7-0 2-9 7Z" />
      <path className="eco-glyph-ghost" d="M0-4 5 6 0 3.5-5 6Z" />
    </g>
  );
}

const PILLARS = [
  {
    key: "dca",
    theme: "rose" as const,
    eyebrow: "01",
    title: "DCA",
    status: "Executing today",
    state: "live" as const,
    body: "Scheduled, non-custodial buys across five chains.",
    beats: ["5 chains live", "Gas prepaid", "Your keys"],
  },
  {
    key: "ai",
    theme: "lavender" as const,
    eyebrow: "02",
    title: "AI",
    status: "Unlocks with the token",
    state: "soon" as const,
    body: "Assistants that shape allocation and cadence around you.",
    beats: ["Guided plans", "Adaptive cadence", "Holder perks"],
  },
  {
    key: "play",
    theme: "sky" as const,
    eyebrow: "03",
    title: "Play",
    status: "Echo Arena is live",
    state: "live" as const,
    body: "Arcade runs that earn Steady Points against your wallet.",
    beats: ["Ranked runs", "Steady Points", "More games"],
  },
] as const;

function TriadEngine() {
  return (
    <svg
      className="eco-engine"
      viewBox="0 0 720 400"
      role="img"
      aria-label="Three pillars — DCA, AI and Play — orbiting one core, each connected by a flowing link."
    >
      <defs>
        {/* User space, not the object box: the core-to-Play link is perfectly
            vertical, and a bounding-box gradient collapses on a zero-width box. */}
        <linearGradient
          id="eco-link"
          gradientUnits="userSpaceOnUse"
          x1="70"
          y1="90"
          x2="650"
          y2="340"
        >
          <stop offset="0%" stopColor="var(--hero-primary)" />
          <stop offset="55%" stopColor="var(--hero-secondary)" />
          <stop offset="100%" stopColor="var(--hero-accent)" />
        </linearGradient>
        <radialGradient id="eco-core-glow">
          <stop offset="0%" stopColor="var(--hero-secondary)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="var(--hero-secondary)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* The triangle the three pillars sit on, drawn as one travelling dash */}
      <path
        className="eco-frame"
        d={`M${NODES[0].x} ${NODES[0].y} L${NODES[1].x} ${NODES[1].y} L${NODES[2].x} ${NODES[2].y} Z`}
      />

      {/* Core → pillar links: light keeps moving outward, forever */}
      {NODES.map((n, i) => (
        <g key={`link-${n.key}`}>
          <path className="eco-link-ghost" d={`M${CX} ${CY} L${n.x} ${n.y}`} />
          <path
            className="eco-link"
            d={`M${CX} ${CY} L${n.x} ${n.y}`}
            style={{ animationDelay: `${i * -0.55}s` }}
          />
        </g>
      ))}

      {/* Core */}
      <circle className="eco-core-glow" cx={CX} cy={CY} r="86" fill="url(#eco-core-glow)" />
      {[0, 1].map((n) => (
        <circle
          key={`ring-${n}`}
          className="eco-core-ring"
          cx={CX}
          cy={CY}
          r="34"
          style={{ animationDelay: `${n * 1.9}s` }}
        />
      ))}
      <circle className="eco-core-disc" cx={CX} cy={CY} r="30" />
      <g transform={`translate(${CX} ${CY})`}>
        <path
          className="eco-core-mark"
          d="M0-14 3.9-3.9 14 0 3.9 3.9 0 14-3.9 3.9-14 0-3.9-3.9Z"
        />
      </g>

      {/* Pillars */}
      {NODES.map((n, i) => (
        <g
          key={n.key}
          className="eco-node"
          transform={`translate(${n.x} ${n.y})`}
          style={
            {
              "--eco-accent": n.accent,
              "--eco-delay": `${i * 0.7}s`,
            } as CSSProperties
          }
        >
          <circle className="eco-node-halo" r="42" />
          <circle className="eco-node-disc" r="30" />
          <circle className="eco-node-ring" r="30" />
          <NodeGlyph node={n.key} />
          <text className="eco-node-label" y="52">
            {n.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function Ecosystem() {
  return (
    <section
      id="ecosystem"
      className="section-pad border-t border-[var(--hero-muted)]/10 relative overflow-hidden bg-transparent"
    >
      <div className="relative z-10 mx-auto max-w-6xl px-4">
        <RevealOnScroll>
          <p className="ps-eyebrow mx-auto mb-4">The stack</p>

          <h2 className="eco-wordmark" aria-label="DCA times AI times Play">
            <span className="eco-word eco-word-1" aria-hidden>
              DCA
            </span>
            <span className="eco-cross" aria-hidden>
              ×
            </span>
            <span className="eco-word eco-word-2" aria-hidden>
              AI
            </span>
            <span className="eco-cross eco-cross-2" aria-hidden>
              ×
            </span>
            <span className="eco-word eco-word-3" aria-hidden>
              Play
            </span>
          </h2>

          <p className="section-title-sub mx-auto mb-10 text-center">
            One core, three ways in.
          </p>
        </RevealOnScroll>

        <RevealOnScroll>
          <TriadEngine />
        </RevealOnScroll>

        <RevealOnScroll className="reveal-stagger">
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {PILLARS.map((p) => (
              <div key={p.key} className="reveal-stagger-item flex">
                <Card3D className="flex-1">
                  <div
                    className={`landing-card-sweet landing-card-${p.theme} eco-pillar h-full p-6`}
                  >
                    <div className="eco-pillar-head">
                      <span className="eco-pillar-step">{p.eyebrow}</span>
                      <span className={`eco-pillar-state eco-pillar-state-${p.state}`}>
                        {p.state === "live" && <span className="eco-pillar-dot" aria-hidden />}
                        {p.status}
                      </span>
                    </div>

                    <h3 className="eco-pillar-title">{p.title}</h3>
                    <p className="eco-pillar-body">{p.body}</p>

                    <ul className="eco-pillar-beats">
                      {p.beats.map((beat) => (
                        <li key={beat} className="landing-chip eco-pillar-beat">
                          {beat}
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
