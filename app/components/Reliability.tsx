import { RevealOnScroll } from "./RevealOnScroll";
import { Card3D } from "./Card3D";

/**
 * The control layer.
 *
 * Everything on this page up to here describes a plan running normally. This section is about the
 * days it does not: an operator holding a plan, a network taken out of service, a route that would
 * revert. All three are real machinery in the backend now (`plan-admin-controls`,
 * `plan-execution-gates`, `network-allocation.service`, the executor's pre-flight estimate), and
 * all three share one property worth putting on the landing page — none of them can touch a user's
 * money or take away their ability to act.
 */

/* ---------------------------------------------------------------
   Hold / resume timeline.

   Two rows over one wall-clock axis, read left to right.

   The top row is time itself: its fill never stops, because time
   doesn't. The bottom row is the wait the plan still owes, drawn as
   a block that spans from *now* (the playhead) to the moment it
   would fire (the due tick). So the block's width is the cooldown
   remaining, and where it sits is when that cooldown lands.

     running  the playhead advances, the due tick holds still — the
              block narrows, and the wait is being spent
     held     the playhead advances and the due tick advances with
              it — the block keeps its width. That is the claim.
     resumed  the due tick holds still again, and the block spends
              exactly the width it was carrying

   The numbers are chosen so that closes on the axis rather than
   roughly: the cooldown starts 2/3 of the axis wide, the hold lands
   3/10 along and lasts 1/3, so the due tick is pushed from 2/3 to
   the far right and the block reaches zero exactly there — under
   the playhead, which is where the buy should visibly happen.
   --------------------------------------------------------------- */
const GUTTER_X = 130; // right edge of the row labels
const PLOT_X0 = 148;
const PLOT_X1 = 934;
const PLOT_Y0 = 60;
const PLOT_Y1 = 212;

const AXIS_X0 = 166;
const AXIS_W = 750;
const AXIS_X1 = AXIS_X0 + AXIS_W;

const ROW_H = 16;
const CLOCK_Y = 94;
const OWED_Y = 166;

const HOLD_X = AXIS_X0 + 225; // 3/10 along the axis
const RESUME_X = AXIS_X0 + 475; // the held window is 1/3 of the axis
const OWED_W = 500; // the cooldown as first drawn: 2/3 of the axis

const CHIP_Y = 123;
const CHIP_H = 30;
const CHIP_TEXT_Y = 142;

const PHASES = [
  {
    key: "run",
    x0: AXIS_X0,
    x1: HOLD_X,
    label: "Running",
    caption: "The wait is being spent",
  },
  {
    key: "held",
    x0: HOLD_X,
    x1: RESUME_X,
    label: "Held",
    caption: "The wait stops being spent",
  },
  {
    key: "resumed",
    x0: RESUME_X,
    x1: AXIS_X1,
    label: "Resumed",
    caption: "It finishes what it had left",
  },
] as const;

function HoldTimeline() {
  return (
    <div className="rl-timeline-scroll">
      <svg
        viewBox="0 0 980 252"
        className="rl-timeline"
        role="img"
        aria-label="A plan's cooldown is drawn as the wait it still owes, sitting between now and the moment it would fire. Holding the plan does not spend that wait: the block keeps its width and the due moment is pushed back by exactly as long as the hold lasted, so resuming never fires the plan immediately."
      >
        {/* One plot area, so the three phases read as one span of time
            rather than three separate cards. */}
        <rect
          className="rl-plot"
          x={PLOT_X0}
          y={PLOT_Y0}
          width={PLOT_X1 - PLOT_X0}
          height={PLOT_Y1 - PLOT_Y0}
          rx="18"
        />
        {/* Only the held window is tinted — it is the one phase that is
            a decision rather than just time passing. */}
        <rect
          className="rl-band"
          x={HOLD_X}
          y={PLOT_Y0 + 10}
          width={RESUME_X - HOLD_X}
          height={PLOT_Y1 - PLOT_Y0 - 20}
          rx="12"
        />

        {PHASES.map((phase, i) => (
          <g
            key={phase.key}
            className={`rl-phase rl-phase-${phase.key}`}
            style={{ animationDelay: `${i * 0.12}s` }}
          >
            <text
              className="rl-phase-label"
              x={(phase.x0 + phase.x1) / 2}
              y="44"
              textAnchor="middle"
            >
              {phase.label}
            </text>
            <text
              className="rl-phase-caption"
              x={(phase.x0 + phase.x1) / 2}
              y="236"
              textAnchor="middle"
            >
              {phase.caption}
            </text>
          </g>
        ))}

        {/* Row labels live in their own gutter, clear of the plot. */}
        <text className="rl-row-label" x={GUTTER_X} y={CLOCK_Y + 12} textAnchor="end">
          wall clock
        </text>
        <rect className="rl-row-bed" x={AXIS_X0} y={CLOCK_Y} width={AXIS_W} height={ROW_H} rx={ROW_H / 2} />

        <text className="rl-row-label" x={GUTTER_X} y={OWED_Y + 12} textAnchor="end">
          wait still owed
        </text>
        <rect className="rl-row-bed" x={AXIS_X0} y={OWED_Y} width={AXIS_W} height={ROW_H} rx={ROW_H / 2} />

        {/* Everything below moves. It is grouped so the loop can fade out
            and back in at the seam — the reset is never seen. */}
        <g className="rl-anim">
          <rect
            className="rl-elapsed"
            x={AXIS_X0}
            y={CLOCK_Y}
            width={AXIS_W}
            height={ROW_H}
            rx={ROW_H / 2}
          />

          {/* The wait owed: translated by the playhead, scaled by what is left. */}
          <g className="rl-owed">
            <rect
              className="rl-owed-len rl-owed-fill"
              x={AXIS_X0}
              y={OWED_Y}
              width={OWED_W}
              height={ROW_H}
              rx={ROW_H / 2}
            />
            <rect
              className="rl-owed-len rl-owed-held"
              x={AXIS_X0}
              y={OWED_Y}
              width={OWED_W}
              height={ROW_H}
              rx={ROW_H / 2}
            />
          </g>

          {/* The due tick. Still while the plan runs, pushed while it is held. */}
          <g className="rl-due">
            <line className="rl-due-line" x1={AXIS_X0} y1={OWED_Y - 14} x2={AXIS_X0} y2={OWED_Y + ROW_H + 14} />
            <text className="rl-due-label" x={AXIS_X0} y={OWED_Y - 20} textAnchor="middle">
              due
            </text>
          </g>

          {/* Now. Ties the two rows to one instant. */}
          <g className="rl-now">
            <line
              className="rl-now-line"
              x1={AXIS_X0}
              y1={CLOCK_Y - 12}
              x2={AXIS_X0}
              y2={OWED_Y + ROW_H + 12}
            />
            <circle className="rl-now-dot" cx={AXIS_X0} cy={CLOCK_Y - 12} r="5" />
          </g>

          <g className="rl-chip rl-chip-held">
            <rect className="rl-chip-box" x={HOLD_X + 30} y={CHIP_Y} width="190" height={CHIP_H} rx="12" />
            <text className="rl-chip-text" x={HOLD_X + 125} y={CHIP_TEXT_Y} textAnchor="middle">
              ⏸ 4d 06h left — frozen
            </text>
          </g>

          <g className="rl-chip rl-chip-resumed">
            <rect className="rl-chip-box" x={RESUME_X + 52} y={CHIP_Y} width="172" height={CHIP_H} rx="12" />
            <text className="rl-chip-text" x={RESUME_X + 138} y={CHIP_TEXT_Y} textAnchor="middle">
              4d 06h still to wait
            </text>
          </g>

          <g className="rl-fire">
            <circle className="rl-fire-ring" cx={AXIS_X1} cy={OWED_Y + ROW_H / 2} r="15" />
            <circle className="rl-fire-core" cx={AXIS_X1} cy={OWED_Y + ROW_H / 2} r="7" />
            <text className="rl-fire-text" x={AXIS_X1} y={OWED_Y + ROW_H + 30} textAnchor="end">
              buy executes
            </text>
          </g>
        </g>
      </svg>
    </div>
  );
}

const GUARDS = [
  {
    theme: "mint" as const,
    icon: "🛡️",
    title: "A hold never moves money",
    body: "An operator can stop the relayer from auto-running one plan. That is all it does: the schedule, your deposit and your enrolment are untouched on-chain, and the reason is shown on the plan card.",
    chip: "Off-chain, advisory",
  },
  {
    theme: "lavender" as const,
    icon: "⏳",
    title: "Paused time is given back",
    body: "The chain's cooldown keeps elapsing whether or not we execute. So a hold records the wait the plan had left, and resuming re-imposes exactly that — a plan is never fired the instant a hold lifts.",
    chip: "Execution gate",
  },
  {
    theme: "peach" as const,
    icon: "🔍",
    title: "Simulated before it is sent",
    body: "Every run is estimated against the live route first. A swap that would revert is skipped with the real reason recorded — nobody's tank pays for a transaction that was never going to land.",
    chip: "No gas on failures",
  },
  {
    theme: "sky" as const,
    icon: "🚦",
    title: "Networks can be taken out of service",
    body: "A paused network stops accepting new plans and stops auto-executing, everywhere at once — the grid above reads its status live. Balances and plans already there stay exactly where they are.",
    chip: "Live status",
  },
  {
    theme: "rose" as const,
    icon: "🔑",
    title: "You can always take over",
    body: "Held, paused, or out of service — the vault does not know about any of it. You can still execute a due plan from your wallet, and cancelling returns the remaining balance to you.",
    chip: "Escape hatch",
  },
  {
    theme: "mint" as const,
    icon: "🧾",
    title: "Every run leaves a receipt",
    body: "How much of the token a swap actually delivered is read out of the swap's own transfer logs, not assumed — so the history on your dashboard is what settled, down to the transaction.",
    chip: "From the chain",
  },
] as const;

/** The two ways a plan can fire, and the rule that decides which one a new plan gets. */
const MODES = [
  {
    key: "auto",
    label: "Auto",
    tag: "One free slot per network",
    body: "The relayer sweeps continuously and fires your plan as soon as its interval is up. Your dashboard's countdown targets the sweep that will actually execute it — not just the on-chain due time.",
  },
  {
    key: "manual",
    label: "Manual",
    tag: "Always available",
    body: "Your plan goes live the same way, and you press go when it comes due. Nothing about it depends on us being awake — the contract is what decides it is ready.",
  },
] as const;

export function Reliability() {
  return (
    <section
      id="reliability"
      className="section-pad border-t border-[var(--hero-muted)]/10 relative overflow-hidden bg-transparent"
    >
      <div className="relative z-1 mx-auto max-w-6xl px-4">
        <RevealOnScroll>
          <p className="ps-eyebrow mx-auto mb-4">Control &amp; reliability</p>
          <h2 className="section-title mb-4 text-center">
            Things go wrong. Nothing of yours goes with them.
          </h2>
          <p className="section-title-sub mx-auto mb-10 text-center">
            Plans can be held, networks can go out of service, routes can fail. Every one of those is
            a switch on <em>our</em> side of the line — none of them reaches your funds, and none of
            them takes away your ability to act yourself.
          </p>
        </RevealOnScroll>

        <RevealOnScroll>
          <div className="rl-stage">
            <p className="rl-stage-title">
              What a hold actually does
              <span className="rl-stage-chip">no transaction is sent</span>
            </p>
            <HoldTimeline />
          </div>
        </RevealOnScroll>

        <RevealOnScroll className="reveal-stagger">
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {GUARDS.map((guard) => (
              <div key={guard.title} className="reveal-stagger-item flex">
                <Card3D className="flex-1">
                  <div className={`landing-card-sweet landing-card-${guard.theme} rl-guard h-full p-6`}>
                    <span className="landing-tile" aria-hidden>
                      {guard.icon}
                    </span>
                    <h3 className="rl-guard-title">{guard.title}</h3>
                    <p className="rl-guard-body">{guard.body}</p>
                    <span className="rl-guard-chip">{guard.chip}</span>
                  </div>
                </Card3D>
              </div>
            ))}
          </div>
        </RevealOnScroll>

        <RevealOnScroll className="reveal-stagger">
          <h3 className="ps-rows-title">Auto or manual — and what &ldquo;auto&rdquo; costs</h3>
          <div className="grid gap-6 md:grid-cols-2">
            {MODES.map((mode) => (
              <div key={mode.key} className="reveal-stagger-item flex">
                <div className={`rl-mode rl-mode-${mode.key} flex-1`}>
                  <div className="rl-mode-head">
                    <span className="rl-mode-label">{mode.label}</span>
                    <span className="rl-mode-tag">{mode.tag}</span>
                  </div>
                  <p className="rl-mode-body">{mode.body}</p>
                  <div className="rl-mode-pulse" aria-hidden>
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="ps-disclaimer">
            Your first auto-execution slot on each network is free. Further plans on that network run
            manually today — additional paid auto slots are on the roadmap, not live, and the app
            says so before you create the plan.
          </p>
        </RevealOnScroll>
      </div>
    </section>
  );
}
