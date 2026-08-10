import type { CSSProperties } from "react";
import { RevealOnScroll } from "./RevealOnScroll";
import { Card3D } from "./Card3D";

const ARENA_URL = "https://earena.steadystake.org";

/** The loop the hull flies, and that every echo replays behind it. */
const FLIGHT_PATH =
  "M360 54 C520 54 648 104 648 164 C648 236 512 286 360 286 C208 286 72 236 72 164 C72 104 200 54 360 54 Z";

/** One ghost per past cycle: further back on the loop, and fainter. */
const ECHOES = [
  { n: 1, delay: "-1.1s", opacity: 0.62 },
  { n: 2, delay: "-2.2s", opacity: 0.4 },
  { n: 3, delay: "-3.3s", opacity: 0.22 },
] as const;

/**
 * The hull and its echoes ride the recorded route itself, so the path is stated
 * once and CSS follows it — no second copy of these coordinates to drift.
 */
const rideRoute = (delay: string): CSSProperties =>
  ({
    offsetPath: `path("${FLIGHT_PATH}")`,
    animationDelay: delay,
  }) as CSSProperties;

/** Drifting hostiles, parked at fixed spots so the loop reads as an arena. */
const DRIFTERS = [
  { x: 208, y: 122, delay: "0s" },
  { x: 470, y: 96, delay: "1.4s" },
  { x: 556, y: 216, delay: "2.6s" },
  { x: 176, y: 232, delay: "3.6s" },
] as const;

function ArenaLoop() {
  return (
    <div className="ar-stage">
      <svg
        className="ar-arena"
        viewBox="0 0 720 340"
        role="img"
        aria-label="Echo Arena: a hull flying a loop while three numbered echoes replay the same path behind it."
      >
        <defs>
          <linearGradient id="ar-trail" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--hero-accent)" />
            <stop offset="50%" stopColor="var(--hero-secondary)" />
            <stop offset="100%" stopColor="var(--hero-primary)" />
          </linearGradient>
        </defs>

        {/* The arena boundary, widening a little each cycle */}
        <rect className="ar-bounds" x="28" y="20" width="664" height="300" rx="150" />
        <rect className="ar-bounds ar-bounds-inner" x="52" y="38" width="616" height="264" rx="132" />

        {/* Scan grid */}
        <g className="ar-grid" aria-hidden>
          {[128, 232, 360, 488, 592].map((x) => (
            <line key={x} x1={x} y1="34" x2={x} y2="306" />
          ))}
          {[96, 170, 244].map((y) => (
            <line key={y} x1="44" y1={y} x2="676" y2={y} />
          ))}
        </g>

        {/* The recorded route */}
        <path className="ar-route-ghost" d={FLIGHT_PATH} />
        <path className="ar-route" d={FLIGHT_PATH} pathLength={1000} />

        {DRIFTERS.map((d) => (
          <g key={`${d.x}-${d.y}`} className="ar-drifter" style={{ animationDelay: d.delay }}>
            <circle cx={d.x} cy={d.y} r="9" className="ar-drifter-ring" />
            <circle cx={d.x} cy={d.y} r="3.4" className="ar-drifter-core" />
          </g>
        ))}

        {/* Echoes first, so the live hull always draws on top of its own past */}
        {ECHOES.map((e) => (
          <g
            key={e.n}
            className="ar-flyer ar-echo"
            style={{ ...rideRoute(e.delay), opacity: e.opacity }}
          >
            <path className="ar-hull" d="M0-12 10 8 0 3-10 8Z" />
          </g>
        ))}

        <g className="ar-flyer ar-ship" style={rideRoute("0s")}>
          <circle className="ar-ship-glow" r="17" />
          <path className="ar-hull ar-hull-live" d="M0-13 11 9 0 3.5-11 9Z" />
        </g>
      </svg>

      <div className="ar-hud" aria-hidden>
        <span className="ar-hud-chip">
          <span className="ar-hud-key">Cycle</span>
          <span className="ar-hud-val ar-hud-cycle" />
        </span>
        <span className="ar-hud-chip">
          <span className="ar-hud-key">Echoes</span>
          <span className="ar-hud-val">3</span>
        </span>
        <span className="ar-hud-chip ar-hud-sp">
          <span className="ar-hud-key">Steady Points</span>
          <span className="ar-hud-val ar-hud-ticker" />
        </span>
      </div>
    </div>
  );
}

const SLOTS = [
  {
    key: "echo",
    theme: "lavender" as const,
    state: "live" as const,
    tag: "Game 01",
    title: "Echo Arena",
    body: "Every cycle you survive becomes the enemy in the next one.",
    chips: ["Endless cycles", "Ranked runs", "Steady Points"],
  },
  {
    key: "next",
    theme: "sky" as const,
    state: "building" as const,
    tag: "Game 02",
    title: "In the workshop",
    body: "A second arcade title, built on the same points ledger.",
    chips: ["Same wallet", "Same ledger"],
  },
  {
    key: "later",
    theme: "peach" as const,
    state: "planned" as const,
    tag: "Game 03",
    title: "On the board",
    body: "The arcade keeps growing — one shared score across all of it.",
    chips: ["More to come"],
  },
] as const;

export function Arcade() {
  return (
    <section
      id="play"
      className="section-pad border-t border-[var(--hero-muted)]/10 relative overflow-hidden bg-transparent"
    >
      <div className="relative z-10 mx-auto max-w-6xl px-4">
        <RevealOnScroll>
          <p className="ps-eyebrow mx-auto mb-4">Play</p>
          <h2 className="section-title mb-4 text-center">
            An arcade that pays attention to your wallet.
          </h2>
          <p className="section-title-sub mx-auto mb-10 text-center">
            Echo Arena is live. More games are coming — all on one points ledger.
          </p>
        </RevealOnScroll>

        <RevealOnScroll>
          <ArenaLoop />

          <div className="ar-cta">
            <a
              href={ARENA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="ss-btn ss-btn-primary ss-btn-lg"
            >
              Play Echo Arena
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M7 17 17 7" />
                <path d="M7 7h10v10" />
              </svg>
            </a>
            <span className="ar-cta-note">earena.steadystake.org · free to play</span>
          </div>
        </RevealOnScroll>

        <RevealOnScroll className="reveal-stagger">
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {SLOTS.map((slot) => {
              const card = (
                <div
                  className={`landing-card-sweet landing-card-${slot.theme} ar-slot ar-slot-${slot.state} h-full p-6`}
                >
                  <div className="ar-slot-head">
                    <span className="ar-slot-tag">{slot.tag}</span>
                    <span className={`ar-slot-state ar-slot-state-${slot.state}`}>
                      {slot.state === "live" ? (
                        <>
                          <span className="ar-slot-dot" aria-hidden />
                          Live
                        </>
                      ) : slot.state === "building" ? (
                        "In build"
                      ) : (
                        "Planned"
                      )}
                    </span>
                  </div>

                  <h3 className="ar-slot-title">{slot.title}</h3>
                  <p className="ar-slot-body">{slot.body}</p>

                  <ul className="ar-slot-chips">
                    {slot.chips.map((chip) => (
                      <li key={chip} className="landing-chip ar-slot-chip">
                        {chip}
                      </li>
                    ))}
                  </ul>

                  {slot.state === "live" && (
                    <span className="ar-slot-go">
                      Open the arena
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <path d="M5 12h14M13 6l6 6-6 6" />
                      </svg>
                    </span>
                  )}
                </div>
              );

              return (
                <div key={slot.key} className="reveal-stagger-item flex">
                  <Card3D className="flex-1">
                    {slot.state === "live" ? (
                      <a
                        href={ARENA_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ar-slot-link"
                      >
                        {card}
                      </a>
                    ) : (
                      card
                    )}
                  </Card3D>
                </div>
              );
            })}
          </div>
        </RevealOnScroll>
      </div>
    </section>
  );
}
