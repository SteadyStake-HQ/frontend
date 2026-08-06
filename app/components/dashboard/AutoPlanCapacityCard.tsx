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

  return (
    <section className="mt-4 rounded-2xl border border-[var(--hero-muted)]/15 bg-white/[0.02] p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span aria-hidden className="text-lg">🏆</span>
          <h3 className="text-sm font-semibold text-[var(--hero-primary)]">
            Reward card capacity
          </h3>
        </div>
        <span className="rounded-full border border-[var(--hero-muted)]/20 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--hero-muted)]">
          {TIER_LABEL[capacity.tier] ?? capacity.tier} plan
        </span>
      </div>

      {/* Bonus-slot usage bar: filled = used, remainder = available. Detail on hover. */}
      <div
        className="mt-4"
        title={`Your reward card adds ${capacity.nftBonus} Auto Execution Plan slot${capacity.nftBonus === 1 ? "" : "s"} shared across every network, on top of your ${baseLabel === "Unlimited" ? "unlimited" : `${baseLabel}-per-network`} base limit. Bonus slots kick in only once a network is at its base limit.`}
      >
        <div className="mb-1 flex items-center justify-between text-[11px] text-[var(--hero-muted)]">
          <span>Bonus slots used</span>
          <span>
            <b className="text-[var(--hero-primary)]">{capacity.usedNftSlots}</b> / {capacity.nftBonus} · {capacity.availableNftSlots} free
          </span>
        </div>
        <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-white/[0.04]">
          {Array.from({ length: capacity.nftBonus }).map((_, i) => (
            <span
              key={i}
              className={`h-full flex-1 rounded-full ${i < capacity.usedNftSlots ? "bg-[var(--hero-primary)]" : "bg-[var(--hero-muted)]/25"}`}
            />
          ))}
        </div>
        <p className="mt-1 text-[11px] text-[var(--hero-muted)]">
          Base limit: <b className="text-[var(--hero-primary)]">{baseLabel}</b> per network · shared across all chains
        </p>
      </div>

      {capacity.perNetwork.length > 0 && (
        <div className="mt-4 border-t border-[var(--hero-muted)]/10 pt-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--hero-muted)]">Per network</p>
          <ul className="grid gap-2 text-[12px]">
            {capacity.perNetwork.map((n) => {
              const base = n.baseLimit ?? n.active; // unlimited base: no bar overflow
              const denom = Math.max(1, (n.baseLimit ?? n.active) + n.excess, n.active);
              const basePart = Math.min(n.active, base);
              return (
                <li
                  key={n.chainId}
                  title={`${n.active} active plan${n.active === 1 ? "" : "s"} — ${basePart} within base${n.excess > 0 ? `, ${n.excess} using reward-card bonus slots` : ""}.`}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[var(--hero-muted)]">{CHAIN_NAMES[n.chainId] ?? `Chain ${n.chainId}`}</span>
                    <span className="text-[var(--hero-primary)]">
                      {n.active} active
                      {n.excess > 0 && <span className="text-amber-400"> · +{n.excess} bonus</span>}
                    </span>
                  </div>
                  <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-white/[0.04]">
                    <span
                      className="h-full rounded-full bg-[var(--hero-primary)]"
                      style={{ width: `${(basePart / denom) * 100}%` }}
                    />
                    {n.excess > 0 && (
                      <span className="h-full rounded-full bg-amber-400" style={{ width: `${(n.excess / denom) * 100}%` }} />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
