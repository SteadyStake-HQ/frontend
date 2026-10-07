"use client";

import { useAutoPlanCapacity } from "@/app/hooks/useAutoPlanCapacity";

const CHAIN_NAMES: Record<number, string> = {
  8453: "Base",
  84532: "Base Sepolia",
  677: "BOT Chain",
  968: "BOT Testnet",
  137: "Polygon",
  56: "BNB Chain",
  2222: "Kava",
  11155111: "Sepolia",
};

const TIER_LABEL: Record<string, string> = {
  starter: "Starter",
  plus: "Plus",
  pro: "Pro",
  institutional: "Institutional",
};

/**
 * Shows a reward-card holder their extra Auto Execution Plan capacity (blueprint §15). The NFT bonus
 * is global across networks, added on top of the membership's per-network base limit — so this makes
 * the "+1 / +2 / +3 slots" concrete: how many are used and how many remain. Rendered only for wallets
 * that actually hold a card, so it never clutters a non-winner's dashboard.
 */
export function AutoPlanCapacityCard() {
  const { capacity, loading, error } = useAutoPlanCapacity();

  // Only meaningful for card holders; silent otherwise (including while loading and on error).
  if (loading || error || !capacity || capacity.nftBonus <= 0) return null;

  const base = capacity.baseLimitPerNetwork;
  const baseLabel = base === null ? "Unlimited" : String(base);

  const slotTip = `Your reward card adds ${capacity.nftBonus} Auto Execution Plan slot${capacity.nftBonus === 1 ? "" : "s"} shared across every network, on top of your ${baseLabel === "Unlimited" ? "unlimited" : `${baseLabel}-per-network`} base limit. Bonus slots kick in only once a network is at its base limit.`;

  return (
    <section className="dx-panel" aria-labelledby="dx-capacity-title">
      <header className="dx-panel-head">
        <div>
          <p className="dx-kicker">Reward card</p>
          <h2 id="dx-capacity-title">Auto-plan capacity</h2>
        </div>
        <span className="dx-state dx-state-held" style={{ ["--dx-tone" as string]: "var(--dx-c4)" }}>
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12 2l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 17l-6.1 3.4 1.5-6.8L2.2 9l6.9-.7z" />
          </svg>
          {TIER_LABEL[capacity.tier] ?? capacity.tier}
        </span>
      </header>

      <div className="dx-capacity">
        {/* One tile per bonus slot: solid = in use, dashed = free. */}
        <div title={slotTip}>
          <div className="dx-capacity-slots" role="img" aria-label={`${capacity.usedNftSlots} of ${capacity.nftBonus} bonus slots used`}>
            {Array.from({ length: capacity.nftBonus }).map((_, i) => (
              <span
                key={i}
                className={`dx-capacity-slot${i < capacity.usedNftSlots ? " is-used" : ""}`}
                style={{ ["--i" as string]: i }}
              >
                <svg viewBox="0 0 24 24" fill={i < capacity.usedNftSlots ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" aria-hidden>
                  <path strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </span>
            ))}
          </div>
          <p className="dx-meter-foot">
            <span>{capacity.availableNftSlots} free</span>
            <b>{capacity.usedNftSlots}/{capacity.nftBonus}</b>
          </p>
          <p className="dx-meter-foot">
            <span>Base / network</span>
            <b>{baseLabel}</b>
          </p>
        </div>

        {capacity.perNetwork.length > 0 && (
          <ul className="dx-capacity-nets" aria-label="Active auto plans per network">
            {capacity.perNetwork.map((n) => {
              const base = n.baseLimit ?? n.active; // unlimited base: no bar overflow
              const denom = Math.max(1, (n.baseLimit ?? n.active) + n.excess, n.active);
              const basePart = Math.min(n.active, base);
              return (
                <li
                  key={n.chainId}
                  className="dx-capacity-net"
                  title={`${n.active} active plan${n.active === 1 ? "" : "s"} — ${basePart} within base${n.excess > 0 ? `, ${n.excess} using reward-card bonus slots` : ""}.`}
                >
                  <span>{CHAIN_NAMES[n.chainId] ?? `Chain ${n.chainId}`}</span>
                  <span className="dx-split-bar" aria-hidden>
                    <i style={{ flexGrow: basePart / denom, background: "var(--dx-active)" }} />
                    {n.excess > 0 && <i style={{ flexGrow: n.excess / denom, background: "var(--dx-c4)" }} />}
                    <i style={{ flexGrow: Math.max(0, 1 - (basePart + n.excess) / denom), background: "color-mix(in srgb, var(--dx-ink-3) 16%, transparent)" }} />
                  </span>
                  <b>
                    {n.active}
                    {n.excess > 0 && <span style={{ color: "var(--dx-c4)" }}> +{n.excess}</span>}
                  </b>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
