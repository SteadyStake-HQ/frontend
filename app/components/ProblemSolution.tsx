import { RevealOnScroll } from "./RevealOnScroll";
import { LottieSection } from "./LottieSection";
import { Card3D } from "./Card3D";

/**
 * Both charts render the same illustrative price series — only the buying
 * behaviour differs, so the two average-entry lines are directly comparable.
 */
const PRICE = [0.35, 0.45, 0.3, 0.55, 0.7, 0.62, 0.85, 0.95, 0.72, 0.5, 0.3, 0.2, 0.35, 0.55, 0.75];
const BASELINE = 168;

const px = (i: number) => 20 + i * 20;
const py = (p: number) => 150 - p * 110;

const LINE_PATH = PRICE.map((p, i) => `${i === 0 ? "M" : "L"}${px(i)},${py(p).toFixed(1)}`).join(" ");
const AREA_PATH = `${LINE_PATH} L${px(PRICE.length - 1)},${BASELINE} L${px(0)},${BASELINE} Z`;

const MANUAL_BUYS = [6, 7, 13];
const MANUAL_SKIPS = [9, 11];
const AUTO_BUYS = [1, 3, 5, 7, 9, 11, 13];
const DIP = 11;

const avgPrice = (indices: number[]) =>
  indices.reduce((sum, i) => sum + PRICE[i], 0) / indices.length;

function PriceChart({ variant }: { variant: "manual" | "auto" }) {
  const manual = variant === "manual";
  const buys = manual ? MANUAL_BUYS : AUTO_BUYS;
  const avgY = py(avgPrice(buys));
  const gradientId = `ps-area-${variant}`;

  return (
    <svg
      viewBox="0 0 384 184"
      className="ps-chart w-full"
      role="img"
      aria-label={
        manual
          ? "Illustrative chart: manual buys cluster near the peaks and the dips are skipped, leaving a high average entry."
          : "Illustrative chart: scheduled buys land in every window, dips included, leaving a lower average entry."
      }
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.32" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>

      {[40, 80, 120, 160].map((y) => (
        <line key={y} className="ps-grid" x1="12" y1={y} x2="300" y2={y} />
      ))}

      <path className="ps-area" d={AREA_PATH} fill={`url(#${gradientId})`} />
      <path className="ps-line" d={LINE_PATH} />

      {/* Fixed execution windows */}
      {!manual &&
        AUTO_BUYS.map((i, n) => (
          <line
            key={`tick-${i}`}
            className="ps-tick"
            x1={px(i)}
            y1={BASELINE}
            x2={px(i)}
            y2={BASELINE + 7}
            style={{ animationDelay: `${1 + n * 0.09}s` }}
          />
        ))}

      {/* Average entry: labelled in the right gutter so nothing overlaps the plot */}
      <line className="ps-avg" x1="12" y1={avgY} x2="300" y2={avgY} />
      <g className="ps-avg-text">
        <text className="ps-avg-cap" x="306" y={avgY - 1}>
          Avg entry
        </text>
        <text x="306" y={avgY + 10}>{manual ? "HIGH ↑" : "LOWER ↓"}</text>
      </g>

      {/* Dips the manual investor froze on */}
      {manual &&
        MANUAL_SKIPS.map((i, n) => (
          <g key={`skip-${i}`} className="ps-skip" style={{ animationDelay: `${1.25 + n * 0.15}s` }}>
            <circle className="ps-skip-ring" cx={px(i)} cy={py(PRICE[i])} r="6" />
            <path
              className="ps-skip-x"
              d={`M${px(i) - 2.6},${py(PRICE[i]) - 2.6} l5.2,5.2 M${px(i) + 2.6},${py(PRICE[i]) - 2.6} l-5.2,5.2`}
            />
          </g>
        ))}
      {manual && (
        <text className="ps-note ps-skip" x={px(11)} y={py(PRICE[11]) + 20} textAnchor="middle" style={{ animationDelay: "1.6s" }}>
          skipped
        </text>
      )}

      {/* The dip the schedule bought anyway */}
      {!manual && (
        <>
          <circle className="ps-pulse-ring" cx={px(DIP)} cy={py(PRICE[DIP])} r="6" />
          <text className="ps-note ps-label" x={px(DIP)} y={py(PRICE[DIP]) + 22} textAnchor="middle">
            bought
          </text>
        </>
      )}

      {/* Buys */}
      {buys.map((i, n) => (
        <circle
          key={`buy-${i}`}
          className="ps-dot"
          cx={px(i)}
          cy={py(PRICE[i])}
          r="5"
          style={{ animationDelay: `${1 + n * 0.11}s` }}
        />
      ))}
    </svg>
  );
}

const PAIRS = [
  {
    theme: "mint" as const,
    problem: {
      title: "Automation costs you custody",
      body: "The recurring-buy tools that actually work live on centralized exchanges. Deposit first, trust the venue, hope withdrawals stay open.",
    },
    solution: {
      title: "Non-custodial by default",
      body: "Your DCA capital stays on-chain, under your control. We trigger the plan you configured — we never take custody of your funds.",
    },
    graphic: "vault" as const,
  },
  {
    theme: "lavender" as const,
    problem: {
      title: "DeFi DCA is a chore you repeat",
      body: "Different chain, different DEX, the same manual steps every single week. Miss a few and the plan quietly dies.",
    },
    solution: {
      title: "One plan, then autopilot",
      body: "Pick token, amount and cadence once, per network. Auto mode repeats on the interval you chose — Daily, Weekly, Bi-weekly or Monthly — and manual mode runs when you say go. Need a cadence that isn't listed? Talk to an admin.",
    },
    graphic: "chains" as const,
  },
  {
    theme: "peach" as const,
    problem: {
      title: "Gas turns into a surprise bill",
      body: "Execution cost moves with the network, runs fail, and “set-and-forget” quietly becomes “check it every morning”.",
    },
    solution: {
      title: "Prepaid Gas Tank",
      body: "Top up a Gas Tank per network with a configurable gas unit. Execution is funded up front, so you know what the automation costs before it runs.",
    },
    graphic: "gas" as const,
  },
];

function MicroGraphic({ kind }: { kind: "vault" | "chains" | "gas" }) {
  if (kind === "vault") {
    return (
      <svg viewBox="0 0 48 48" className="ps-glyph" aria-hidden>
        <path
          className="ps-glyph-fill"
          d="M24 4 L40 10 V24 C40 34 32 41 24 44 C16 41 8 34 8 24 V10 Z"
        />
        <path
          className="ps-glyph-stroke"
          d="M24 4 L40 10 V24 C40 34 32 41 24 44 C16 41 8 34 8 24 V10 Z"
        />
        <path className="ps-glyph-stroke ps-check" d="M16.5 24 l5.5 5.5 l9.5 -11" />
      </svg>
    );
  }

  if (kind === "chains") {
    return (
      <svg viewBox="0 0 48 48" className="ps-glyph" aria-hidden>
        <rect className="ps-glyph-fill" x="15" y="3" width="18" height="9" rx="4.5" />
        <rect className="ps-glyph-stroke" x="15" y="3" width="18" height="9" rx="4.5" fill="none" />
        <path className="ps-glyph-stroke ps-flow" d="M24 12 V22 M10 34 L24 22 L38 34 M24 22 V34" fill="none" />
        {[10, 24, 38].map((cx, n) => (
          <circle
            key={cx}
            className="ps-node"
            cx={cx}
            cy={38}
            r="4.5"
            style={{ animationDelay: `${n * 0.35}s` }}
          />
        ))}
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 48 48" className="ps-glyph" aria-hidden>
      <defs>
        <clipPath id="ps-tank-clip">
          <rect x="12" y="10" width="19" height="30" rx="5" />
        </clipPath>
      </defs>
      <g clipPath="url(#ps-tank-clip)">
        <rect className="ps-tank-fill" x="12" y="10" width="19" height="30" />
      </g>
      <rect className="ps-glyph-stroke" x="12" y="10" width="19" height="30" rx="5" fill="none" />
      <path className="ps-glyph-stroke" d="M31 18 h5 a3 3 0 0 1 3 3 v13 a3 3 0 0 0 3 3" fill="none" />
      <path className="ps-bolt" d="M23 16 l-5 11 h4.5 l-1.5 8 l6.5 -12 h-4.5 z" />
    </svg>
  );
}

export function ProblemSolution() {
  return (
    <section
      id="problem"
      className="section-pad border-t border-[var(--hero-muted)]/10 relative overflow-hidden bg-transparent"
    >
      <div className="relative z-1 mx-auto max-w-6xl px-4">
        <RevealOnScroll>
          <div className="mb-6 flex justify-center">
            <LottieSection name="problem" size={110} />
          </div>
          <p className="ps-eyebrow mx-auto mb-4">The problem → our solution</p>
          <h2 className="section-title mb-4 text-center">Consistency is hard. We made it automatic.</h2>
          <p className="section-title-sub mx-auto mb-12 text-center">
            Same market, two behaviours. Manual buying chases green candles and freezes in the red — a funded
            schedule just keeps buying.
          </p>
        </RevealOnScroll>

        <RevealOnScroll className="reveal-stagger">
          <div className="grid items-stretch gap-6 md:grid-cols-2 md:gap-8">
            {/* Problem panel */}
            <div className="reveal-stagger-item">
              <div className="landing-card-sweet landing-card-rose ps-panel h-full p-6">
                <p className="ps-panel-eyebrow">Today · manual &amp; emotional</p>
                <h3 className="ps-panel-title">You buy when it feels right</h3>
                <p className="ps-panel-lead">
                  Buys land after the pump, and the dips — the whole point of DCA — get skipped.
                </p>
                <PriceChart variant="manual" />
                <ul className="ps-chips">
                  <li className="ps-chip">3 buys in 15 windows</li>
                  <li className="ps-chip">2 dips skipped</li>
                  <li className="ps-chip">Emotion sets the timing</li>
                </ul>
              </div>
            </div>

            {/* Solution panel */}
            <div className="reveal-stagger-item">
              <div className="landing-card-sweet landing-card-mint ps-panel h-full p-6">
                <p className="ps-panel-eyebrow">With SteadyStake · scheduled</p>
                <h3 className="ps-panel-title">The schedule buys for you</h3>
                <p className="ps-panel-lead">
                  Every window executes from your own vault — including the ones you would have skipped.
                </p>
                <PriceChart variant="auto" />
                <ul className="ps-chips">
                  <li className="ps-chip">7 of 7 windows executed</li>
                  <li className="ps-chip">Dips included</li>
                  <li className="ps-chip">The plan sets the timing</li>
                </ul>
              </div>
            </div>
          </div>
          <p className="ps-disclaimer">
            Illustrative example. Both charts use the same price series — only the execution behaviour changes.
          </p>
        </RevealOnScroll>

        <RevealOnScroll className="reveal-stagger">
          <h3 className="ps-rows-title">Three things break DCA — here is what we do about each</h3>

          <div className="space-y-5">
            {PAIRS.map((pair) => (
              <div key={pair.graphic} className="reveal-stagger-item">
                <div className="grid items-center gap-4 md:grid-cols-[1fr_auto_1fr] md:gap-6">
                  <div className="ps-pain h-full p-5">
                    <div className="mb-2 flex items-center gap-2.5">
                      <span className="ps-pain-icon" aria-hidden>
                        <svg viewBox="0 0 16 16">
                          <path d="M5 5 l6 6 M11 5 l-6 6" />
                        </svg>
                      </span>
                      <h4 className="ps-pain-title">{pair.problem.title}</h4>
                    </div>
                    <p className="ps-pain-body">{pair.problem.body}</p>
                  </div>

                  <div className="ps-connector" aria-hidden>
                    <svg viewBox="0 0 48 24">
                      <path className="ps-flow ps-connector-line" d="M2 12 H36" />
                      <path className="ps-connector-head" d="M33 6 L43 12 L33 18" />
                    </svg>
                  </div>

                  <Card3D>
                    <div className={`landing-card-sweet landing-card-${pair.theme} h-full p-5`}>
                      <div className="flex items-start gap-4">
                        <MicroGraphic kind={pair.graphic} />
                        <div>
                          <h4 className="ps-fix-title">{pair.solution.title}</h4>
                          <p className="ps-fix-body">{pair.solution.body}</p>
                        </div>
                      </div>
                    </div>
                  </Card3D>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-8 text-center text-sm font-medium text-[var(--hero-primary)]">
            Core differentiator: prepaid gas model and reliable auto-execution — so you know exactly what
            automation costs.
          </p>
        </RevealOnScroll>
      </div>
    </section>
  );
}
