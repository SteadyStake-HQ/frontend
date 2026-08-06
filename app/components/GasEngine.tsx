import { RevealOnScroll } from "./RevealOnScroll";
import { Card3D } from "./Card3D";
import { DEFAULT_CHAIN_ID, getStableSymbol } from "@/config/contracts";

/**
 * The Gas Tank section.
 *
 * Everything the app charges a user flows through this one balance, and the rules behind it changed
 * enough that the rest of the landing page can no longer carry them in a sentence: there is no
 * per-run price any more (the relayer debits the gas a run actually burned), balances pool across
 * networks of the same kind rather than across all of them, a plan is sized on the worst run a
 * network has had rather than on a flat multiple, and whatever is not spent stays withdrawable.
 *
 * The landing page has no wallet, so nothing here quotes a figure for a specific network — that is
 * Economics' job, where the receipt prices a real plan off `useRunCostUsd`. This section explains
 * the mechanism the receipt is pricing.
 */
const STABLE = getStableSymbol(DEFAULT_CHAIN_ID);

/* ---------------------------------------------------------------
   Pool diagram geometry. Five tanks on one row feed one reservoir,
   and a single run draws from the reservoir below it.
   --------------------------------------------------------------- */
const TANKS = [
  { name: "BOT Chain", icon: "/bot.svg", fill: 0.82 },
  { name: "BNB Chain", icon: "/bsc.svg", fill: 0.46 },
  { name: "Base", icon: "/base.svg", fill: 0.63 },
  { name: "Polygon", icon: "/polygon.svg", fill: 0.3 },
  { name: "Kava", icon: "/kava.svg", fill: 0.55 },
] as const;

const TANK_X = [140, 320, 500, 680, 860];
const TANK_TOP = 34;
const TANK_H = 62;
const TANK_W = 46;
const POOL_Y = 168;
const POOL_X0 = 116;
const POOL_X1 = 884;
const RUN_Y = 262;

function PoolDiagram() {
  return (
    <div className="ge-pool-scroll">
      <svg
        viewBox="0 0 1000 300"
        className="ge-pool"
        role="img"
        aria-label="Five per-network gas tanks feed one shared balance, and each scheduled run draws from that shared balance the exact gas it burned."
      >
        <defs>
          {/*
            Deliberately quiet. The two labels sit *inside* this bar, so the fill has to stay a
            tint rather than a paint — at full saturation the brand green swallows both of them.
          */}
          <linearGradient id="ge-pool-liquid" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" />
            <stop offset="55%" stopColor="currentColor" stopOpacity="0.46" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.3" />
          </linearGradient>
          <clipPath id="ge-pool-clip">
            <rect x={POOL_X0} y={POOL_Y} width={POOL_X1 - POOL_X0} height="40" rx="12" />
          </clipPath>
        </defs>

        {/* --- Per-network tanks --- */}
        {TANKS.map((tank, i) => {
          const x = TANK_X[i];
          const liquidH = TANK_H * tank.fill;
          return (
            <g key={tank.name} className="ge-tank" style={{ animationDelay: `${i * 0.12}s` }}>
              <clipPath id={`ge-tank-clip-${i}`}>
                <rect x={x - TANK_W / 2} y={TANK_TOP} width={TANK_W} height={TANK_H} rx="10" />
              </clipPath>
              <rect
                className="ge-tank-bed"
                x={x - TANK_W / 2}
                y={TANK_TOP}
                width={TANK_W}
                height={TANK_H}
                rx="10"
              />
              <g clipPath={`url(#ge-tank-clip-${i})`}>
                <rect
                  className="ge-tank-liquid"
                  x={x - TANK_W / 2}
                  y={TANK_TOP + TANK_H - liquidH}
                  width={TANK_W}
                  height={liquidH}
                  style={{ animationDelay: `${0.4 + i * 0.12}s` }}
                />
              </g>
              <rect
                className="ge-tank-wall"
                x={x - TANK_W / 2}
                y={TANK_TOP}
                width={TANK_W}
                height={TANK_H}
                rx="10"
              />
              <image
                href={tank.icon}
                x={x - 11}
                y={TANK_TOP - 30}
                width="22"
                height="22"
                className="ge-tank-mark"
              />
              <text className="ge-tank-name" x={x} y={TANK_TOP + TANK_H + 17} textAnchor="middle">
                {tank.name}
              </text>

              {/* Feed line down into the shared reservoir */}
              <path
                className="ge-feed"
                d={`M${x} ${TANK_TOP + TANK_H + 26} V${POOL_Y - 4}`}
              />
              <circle
                className="ge-feed-drop"
                cx={x}
                cy={TANK_TOP + TANK_H + 26}
                r="3.2"
                style={{ animationDelay: `${i * 0.55}s` }}
              />
            </g>
          );
        })}

        {/* --- The shared reservoir --- */}
        <g className="ge-reservoir">
          <rect
            className="ge-pool-bed"
            x={POOL_X0}
            y={POOL_Y}
            width={POOL_X1 - POOL_X0}
            height="40"
            rx="12"
          />
          <g clipPath="url(#ge-pool-clip)">
            <rect
              className="ge-pool-liquid"
              x={POOL_X0}
              y={POOL_Y}
              width={POOL_X1 - POOL_X0}
              height="40"
              fill="url(#ge-pool-liquid)"
            />
            <rect className="ge-pool-sheen" x={POOL_X0} y={POOL_Y} width="180" height="40" />
          </g>
          <rect
            className="ge-pool-wall"
            x={POOL_X0}
            y={POOL_Y}
            width={POOL_X1 - POOL_X0}
            height="40"
            rx="12"
          />
          <text className="ge-pool-label" x={POOL_X0 + 18} y={POOL_Y + 25}>
            ONE POOLED BALANCE
          </text>
          <text className="ge-pool-sub" x={POOL_X1 - 18} y={POOL_Y + 25} textAnchor="end">
            spends on any mainnet
          </text>
        </g>

        {/* --- One run drawing from the pool --- */}
        <path className="ge-draw" d={`M500 ${POOL_Y + 40} V${RUN_Y - 20}`} />
        {[0, 1].map((n) => (
          <circle
            key={`draw-${n}`}
            className="ge-draw-drop"
            cx="500"
            cy={POOL_Y + 40}
            r="3.6"
            style={{ animationDelay: `${n * 1.6}s` }}
          />
        ))}

        <g className="ge-run">
          <rect className="ge-run-box" x="386" y={RUN_Y - 20} width="228" height="38" rx="12" />
          <text className="ge-run-text" x="500" y={RUN_Y + 5} textAnchor="middle">
            ⚡ one run — charged what it burned
          </text>
        </g>
      </svg>
    </div>
  );
}

/**
 * The precedence behind every per-run figure the app shows. Mirrors `useRunCostUsd`: a measured
 * average when the network has one, a live estimate when it does not, and the build-time backstop
 * only when neither can be read. The rung the app landed on is always printed beside the number,
 * which is the point of publishing the ladder at all.
 */
const LADDER = [
  {
    rank: "1st",
    key: "measured",
    theme: "mint" as const,
    title: "Measured",
    lead: "The average of what real runs on that network actually cost.",
    detail:
      "Every completed run reports its receipt back, and every one of them is kept — all plans, all networks, no window. The quote is a record, not a guess, and the range they landed in is shown with it.",
    badge: "measured · N runs",
  },
  {
    rank: "2nd",
    key: "live",
    theme: "lavender" as const,
    title: "Live estimate",
    lead: "Gas price × gas burned × the native token's price, read this minute.",
    detail:
      "For a network that has not run yet. The gas figure comes from simulating the exact two transactions the next run would send — through the live DEX route, from the relayer's own address.",
    badge: "estimated",
  },
  {
    rank: "3rd",
    key: "seed",
    theme: "sky" as const,
    title: "Backstop",
    lead: "A per-network constant, used only when nothing above can be read.",
    detail:
      "Deliberately set high. A quote that can't be evidenced should never come in under what the run will really cost.",
    badge: "seeded",
  },
] as const;

const RULES = [
  {
    theme: "peach" as const,
    icon: "🧾",
    title: "Charged at cost",
    body: `No per-run price exists to look up. The relayer debits the gas the run's own receipt records, converted at the network's live token price — no markup, no rounding in our favour.`,
    chip: "0% markup",
  },
  {
    theme: "mint" as const,
    icon: "🔗",
    title: "One balance, many networks",
    body: "Top up on whichever network is convenient. Mainnet tanks spend as a single pool, so a plan never stalls because the money sat on the wrong chain.",
    chip: "Pooled",
  },
  {
    theme: "lavender" as const,
    icon: "📏",
    title: "Sized on the bad day",
    body: "A plan is prepaid at the worst run that network has had, times its run count — not a flat multiple. Enough to see the plan through without over-reserving.",
    chip: "worst run × runs",
  },
  {
    theme: "sky" as const,
    icon: "↩️",
    title: "Unspent stays yours",
    body: `Whatever the plan does not burn is still your ${STABLE}. Withdraw the balance from the tank whenever you like — it is not a fee you have paid.`,
    chip: "Withdrawable",
  },
] as const;

export function GasEngine() {
  return (
    <section
      id="gas-tank"
      className="section-pad border-t border-[var(--hero-muted)]/10 relative overflow-hidden bg-transparent"
    >
      <div className="relative z-1 mx-auto max-w-6xl px-4">
        <RevealOnScroll>
          <p className="ps-eyebrow mx-auto mb-4">Gas Tank</p>
          <h2 className="section-title mb-4 text-center">
            One balance funds every run. It is charged what it burns.
          </h2>
          <p className="section-title-sub mx-auto mb-10 text-center">
            Automation has to pay for itself somehow, and everyone else hides that in a percentage.
            We put it in a balance you own, spend it at cost, and show the evidence behind every
            figure.
          </p>
        </RevealOnScroll>

        <RevealOnScroll>
          <PoolDiagram />
          <p className="ge-pool-foot">
            Mainnet tanks pool with mainnet tanks and testnet with testnet — never across the two, so
            a faucet balance can never read as funding a real run. Paying for a run from another
            network&apos;s tank works, and costs a little more: the transaction that debits it runs on{" "}
            <em>that</em> network too.
          </p>
        </RevealOnScroll>

        {/* The four rules of the tank */}
        <RevealOnScroll className="reveal-stagger">
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {RULES.map((rule) => (
              <div key={rule.title} className="reveal-stagger-item flex">
                <Card3D className="flex-1">
                  <div className={`landing-card-sweet landing-card-${rule.theme} ge-rule h-full p-6`}>
                    <span className="landing-tile" aria-hidden>
                      {rule.icon}
                    </span>
                    <h3 className="ge-rule-title">{rule.title}</h3>
                    <p className="ge-rule-body">{rule.body}</p>
                    <span className="ge-rule-chip">{rule.chip}</span>
                  </div>
                </Card3D>
              </div>
            ))}
          </div>
        </RevealOnScroll>

        {/* Where a quoted per-run figure comes from */}
        <RevealOnScroll>
          <h3 className="ps-rows-title">Where that number comes from</h3>
          <p className="ge-ladder-lead">
            A cost that follows gas can be quoted three ways, and they are not the same claim. The
            app always takes the best one available — and prints which one it used next to the
            figure.
          </p>
        </RevealOnScroll>

        <RevealOnScroll className="reveal-stagger">
          <ol className="ge-ladder">
            {LADDER.map((rung, i) => (
              <li key={rung.key} className="reveal-stagger-item">
                <div className={`landing-card-sweet landing-card-${rung.theme} ge-rung p-6`}>
                  <span className="ge-rung-beam" aria-hidden style={{ animationDelay: `${i * 0.9}s` }} />
                  <div className="ge-rung-head">
                    <span className="ge-rung-rank">{rung.rank}</span>
                    <h4 className="ge-rung-title">{rung.title}</h4>
                    <code className="ge-rung-badge">{rung.badge}</code>
                  </div>
                  <p className="ge-rung-lead">{rung.lead}</p>
                  <p className="ge-rung-detail">{rung.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </RevealOnScroll>

        <RevealOnScroll>
          <p className="ps-disclaimer">
            The same rule drives the worked example below, the plan creator&apos;s prepay, and the
            runs-left gauge on your dashboard — so the three can never quote you different numbers.
          </p>
        </RevealOnScroll>
      </div>
    </section>
  );
}
