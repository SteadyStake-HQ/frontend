import { RevealOnScroll } from "./RevealOnScroll";
import { Card3D } from "./Card3D";

/* ---------------------------------------------------------------
   Pipeline geometry. Nodes sit on one straight rail, so the moving
   "value packets" are a plain translateX — no offset-path needed.
   --------------------------------------------------------------- */
const RAIL_Y = 104;
const NODE_X = [110, 350, 590, 830];
const RAIL_START = NODE_X[0];
const RAIL_END = NODE_X[3];

const NODES = [
  { label: "Fund", caption: "USDC into your vault", actor: "you" },
  { label: "Configure", caption: "Token · amount · frequency", actor: "you" },
  { label: "Execute", caption: "On schedule, from your vault", actor: "us" },
  { label: "Accumulate", caption: "Tokens land back in your vault", actor: "you" },
] as const;

function NodeGlyph({ index }: { index: number }) {
  // Drawn around (0,0); the parent <g> translates it onto the rail.
  if (index === 0) {
    return (
      <g className="hw-glyph">
        <rect className="hw-glyph-stroke" x="-13" y="-9" width="26" height="18" rx="4" />
        <path className="hw-glyph-stroke" d="M-13 -4 h26" />
        <circle className="hw-glyph-fill-solid" cx="7" cy="3" r="2.4" />
      </g>
    );
  }

  if (index === 1) {
    return (
      <g className="hw-glyph">
        <path className="hw-glyph-stroke" d="M-12 -6 h24 M-12 6 h24" />
        <circle className="hw-glyph-fill-solid hw-slide-a" cx="-4" cy="-6" r="3.6" />
        <circle className="hw-glyph-fill-solid hw-slide-b" cx="5" cy="6" r="3.6" />
      </g>
    );
  }

  if (index === 2) {
    return (
      <g className="hw-glyph">
        <circle className="hw-glyph-stroke" cx="0" cy="0" r="12" />
        <path className="hw-glyph-stroke" d="M0 0 L5 4" />
        <path className="hw-glyph-stroke hw-hand" d="M0 0 V-7" />
      </g>
    );
  }

  return (
    <g className="hw-glyph">
      <path className="hw-glyph-stroke hw-trend" d="M-12 7 L-4 -1 L2 4 L12 -7" />
      <path className="hw-glyph-stroke" d="M12 -7 h-6 M12 -7 v6" />
    </g>
  );
}

function Pipeline() {
  return (
    <div className="hw-pipe-scroll">
      <svg
        viewBox="0 0 940 210"
        className="hw-pipe"
        role="img"
        aria-label="Pipeline: you fund a vault and configure a plan, SteadyStake executes it on schedule using the prepaid Gas Tank, and the purchased tokens land back in your own vault."
      >
        {/* Rail */}
        <line className="hw-rail" x1={RAIL_START} y1={RAIL_Y} x2={RAIL_END} y2={RAIL_Y} />
        <line className="hw-rail-flow" x1={RAIL_START} y1={RAIL_Y} x2={RAIL_END} y2={RAIL_Y} />

        {/* Value packets travelling down the rail */}
        {[0, 1, 2].map((n) => (
          <circle
            key={`packet-${n}`}
            className="hw-packet"
            cx={RAIL_START}
            cy={RAIL_Y}
            r="4.5"
            style={{ animationDelay: `${1.4 + n * 1.5}s` }}
          />
        ))}

        {/* Gas Tank feeding the executor from below */}
        <g className="hw-tank">
          <rect className="hw-tank-box" x={NODE_X[2] - 46} y="158" width="92" height="34" rx="10" />
          <text className="hw-tank-label" x={NODE_X[2]} y="179" textAnchor="middle">
            ⛽ Gas Tank
          </text>
          <path className="hw-feed" d={`M${NODE_X[2]} 158 V${RAIL_Y + 34}`} />
          {[0, 1].map((n) => (
            <circle
              key={`fuel-${n}`}
              className="hw-fuel"
              cx={NODE_X[2]}
              cy="156"
              r="3"
              style={{ animationDelay: `${n * 1.1}s` }}
            />
          ))}
        </g>

        {/* Nodes */}
        {NODES.map((node, i) => (
          <g key={node.label} className="hw-node" style={{ animationDelay: `${i * 0.18}s` }}>
            {i === 2 && <circle className="hw-node-pulse" cx={NODE_X[i]} cy={RAIL_Y} r="32" />}
            <circle className="hw-node-ring" cx={NODE_X[i]} cy={RAIL_Y} r="32" />
            <g transform={`translate(${NODE_X[i]}, ${RAIL_Y})`}>
              <NodeGlyph index={i} />
            </g>

            {/* Step number */}
            <circle className="hw-node-badge" cx={NODE_X[i] + 24} cy={RAIL_Y - 24} r="11" />
            <text className="hw-node-num" x={NODE_X[i] + 24} y={RAIL_Y - 20} textAnchor="middle">
              {i + 1}
            </text>

            <text className="hw-node-label" x={NODE_X[i]} y="20" textAnchor="middle">
              {node.label}
            </text>
            <text className="hw-node-caption" x={NODE_X[i]} y="40" textAnchor="middle">
              {node.caption}
            </text>

            {/* Who acts: you, or the automation */}
            <g transform={`translate(${NODE_X[i]}, 56)`}>
              <rect
                className={`hw-actor-pill hw-actor-${node.actor}`}
                x="-31"
                y="-10"
                width="62"
                height="18"
                rx="9"
              />
              <text className={`hw-actor-text hw-actor-text-${node.actor}`} x="0" y="3" textAnchor="middle">
                {node.actor === "you" ? "YOU" : "AUTOMATED"}
              </text>
            </g>
          </g>
        ))}
      </svg>
    </div>
  );
}

/** Built-in cadences a user can pick in the plan modal (see config/frequencies-env.ts). */
const CADENCES = ["Daily", "Weekly", "Bi-weekly", "Monthly"] as const;

/**
 * Cadence picker mock: the highlight walks the chips on a loop, so the card
 * shows that the interval is a choice rather than a fixed window we impose.
 */
function CadencePicker() {
  return (
    <div className="hw-cadence" aria-hidden>
      <div className="hw-cadence-chips">
        {CADENCES.map((label, i) => (
          <span
            key={label}
            className="hw-cadence-chip"
            style={{ animationDelay: `${i * 1.1}s` }}
          >
            {label}
          </span>
        ))}
      </div>
      <div className="hw-cadence-track">
        <span className="hw-cadence-pulse" />
      </div>
    </div>
  );
}

const STEPS = [
  {
    step: 1,
    theme: "mint" as const,
    title: "Fund it once",
    lead: "Two balances, both yours.",
    rows: [
      { k: "DCA capital", v: "USDC you want to invest" },
      { k: "Gas Tank", v: "Prepaid USDC for execution" },
    ],
    foot: "One Gas Tank balance covers every network.",
  },
  {
    step: 2,
    theme: "lavender" as const,
    title: "Set the plan",
    lead: "Pick it once, per network.",
    rows: [
      { k: "Token", v: "Whatever the DEX router supports" },
      { k: "Cadence", v: "Choose a built-in interval" },
    ],
    cadence: true,
    foot: "Need an interval that isn't listed? Contact an admin for a custom period.",
  },
  {
    step: 3,
    theme: "peach" as const,
    title: "It runs itself",
    lead: "Auto or manual — your call.",
    rows: [
      { k: "Auto", v: "Repeats on the interval you selected" },
      { k: "Manual", v: "You press go when ready" },
    ],
    foot: "Funds stay in your vault until each swap.",
  },
] as const;

const GUARANTEES = [
  { icon: "🔒", text: "Non-custodial" },
  { icon: "🎛️", text: "Cancel anytime" },
  { icon: "⛽", text: "Gas paid up front" },
  { icon: "🌐", text: "4 live networks" },
] as const;

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="section-pad border-t border-[var(--hero-muted)]/10 relative overflow-hidden bg-transparent"
    >
      <div className="relative z-1 mx-auto max-w-6xl px-4">
        <RevealOnScroll>
          <p className="ps-eyebrow mx-auto mb-4">How it works</p>
          <h2 className="section-title mb-4 text-center">Three steps. Then it runs itself.</h2>
          <p className="section-title-sub mx-auto mb-10 text-center">
            You fund and configure once. From there the executor does the repeating — and your money never
            leaves your own vault to get there.
          </p>
        </RevealOnScroll>

        <RevealOnScroll>
          <Pipeline />
        </RevealOnScroll>

        <RevealOnScroll className="reveal-stagger">
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {STEPS.map((item) => (
              <div key={item.step} className="reveal-stagger-item">
                <Card3D>
                  <div className={`landing-card-sweet landing-card-${item.theme} hw-step h-full p-6`}>
                    <div className="hw-step-head">
                      <span className="hw-step-num">{item.step}</span>
                      <div>
                        <h3 className="hw-step-title">{item.title}</h3>
                        <p className="hw-step-lead">{item.lead}</p>
                      </div>
                    </div>

                    <dl className="hw-rows">
                      {item.rows.map((row) => (
                        <div key={row.k} className="hw-row">
                          <dt className="hw-row-k">{row.k}</dt>
                          <dd className="hw-row-v">{row.v}</dd>
                        </div>
                      ))}
                    </dl>

                    {"cadence" in item && item.cadence && <CadencePicker />}

                    <p className="hw-step-foot">{item.foot}</p>
                  </div>
                </Card3D>
              </div>
            ))}
          </div>
        </RevealOnScroll>

        <RevealOnScroll>
          <ul className="hw-guarantees">
            {GUARANTEES.map((g) => (
              <li key={g.text} className="hw-guarantee">
                <span aria-hidden>{g.icon}</span>
                {g.text}
              </li>
            ))}
          </ul>
        </RevealOnScroll>
      </div>
    </section>
  );
}
