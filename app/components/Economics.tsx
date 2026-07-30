"use client";

import { useMemo, useState } from "react";
import { RevealOnScroll } from "./RevealOnScroll";
import { Card3D } from "./Card3D";
import { getStableSymbol } from "@/config/contracts";
import { SUPPORTED_CHAIN_IDS } from "@/config/chains-env";
import { useNetworkAllocation } from "@/app/hooks/useNetworkAllocation";
import { useRunCostUsd } from "@/app/hooks/useRunCost";

/** Illustrative recurring-buy fee charged by a typical centralized venue. The one stand-in left. */
const COMPARISON_FEE_RATE = 0.01;

/**
 * The three cadences, over the same year.
 *
 * The span is deliberately identical across all three: the point of the comparison below is that
 * cost tracks *executions*, and a tab that quietly shortened the horizon would hide the effect it
 * exists to show. Per-run amounts are chosen so all three commit roughly the same capital over
 * that year — so what actually differs between tabs is 365 runs versus 52 versus 12.
 */
const PLANS = [
  { id: "daily", tab: "Daily", every: "day", amount: 7, runs: 365 },
  { id: "weekly", tab: "Weekly", every: "week", amount: 50, runs: 52 },
  { id: "monthly", tab: "Monthly", every: "month", amount: 215, runs: 12 },
] as const;

/**
 * Networks the worked example can be priced on, in the order the rest of the landing page uses.
 *
 * Narrowed to what this build can actually talk to: pricing needs a wagmi transport to read the
 * chain's gas price, so a mainnet chain listed by a testnet build would quote from the backstop
 * constant and look measured. If the intersection is empty the full list stands — the card still
 * needs something to name, and every figure on it is labelled with where it came from.
 */
const ALL_PRICEABLE = [
  { chainId: 677, name: "BOT Chain", icon: "/bot.svg" },
  { chainId: 8453, name: "Base", icon: "/base.svg" },
  { chainId: 56, name: "BNB Chain", icon: "/bsc.svg" },
  { chainId: 137, name: "Polygon", icon: "/polygon.svg" },
  { chainId: 2222, name: "Kava", icon: "/kava.svg" },
] as const;

const inBuild = ALL_PRICEABLE.filter((n) => SUPPORTED_CHAIN_IDS.includes(n.chainId));
const PRICEABLE = inBuild.length > 0 ? inBuild : [...ALL_PRICEABLE];

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

/** A per-run charge is often fractions of a cent, where two decimal places round it to nothing. */
const usdPrecise = (n: number) =>
  n >= 0.01
    ? usd(n)
    : `$${n.toLocaleString("en-US", { maximumSignificantDigits: 2, minimumSignificantDigits: 1 })}`;

/**
 * The worked example, priced off the network's own record rather than a constant.
 *
 * Every figure below except the 1% comparison is read at runtime: what a run costs comes from
 * `useRunCostUsd`, which prefers the average of real runs on that chain, falls back to a live
 * gas-price estimate, and only then to the build-time backstop. Which of the three it was is shown
 * on the row, because "measured over 340 runs" and "estimated" are not the same claim.
 */
function Receipt() {
  const [planId, setPlanId] = useState<(typeof PLANS)[number]["id"]>("weekly");
  const plan = PLANS.find((p) => p.id === planId)!;

  const allocation = useNetworkAllocation();
  /**
   * Every priceable network stays on screen with the operator's live answer attached, rather than
   * the paused ones being filtered out. Two reasons: a list that shrinks when the allocation lands
   * makes the card jump, and a visitor comparing networks is better served by "Base is paused"
   * than by Base silently vanishing — which is the same thing the grid above already tells them.
   *
   * Only an open network can be selected, so the example is never priced as though a plan started
   * today on a paused chain would run. If nothing is open — every network on hold, or the
   * allocation unreachable — the list is left selectable: this card quotes costs and claims
   * nothing about service, so it stays useful while the app above it is closed.
   */
  const { networks, openIds } = useMemo(() => {
    const open = PRICEABLE.filter((n) => allocation.acceptsNewPlans(n.chainId)).map(
      (n) => n.chainId,
    );
    return {
      networks: PRICEABLE,
      openIds: new Set<number>(open.length > 0 ? open : PRICEABLE.map((n) => n.chainId)),
    };
  }, [allocation]);

  const [chainId, setChainId] = useState<number>(PRICEABLE[0].chainId);
  const active = openIds.has(chainId)
    ? chainId
    : (networks.find((n) => openIds.has(n.chainId)) ?? networks[0]).chainId;

  const run = useRunCostUsd(active);
  const stable = getStableSymbol(active);

  const capital = plan.amount * plan.runs;
  const gasSpent = plan.runs * run.typicalUsd;
  // What the plan needs banked, sized the way the app itself sizes it: the worst run this network
  // has had, times the run count. The old 3x buffer is gone — see useGasTank.ts.
  const prepay = plan.runs * run.worstUsd;
  const elsewhere = capital * COMPARISON_FEE_RATE;
  const gasBarPct = Math.min(Math.max((gasSpent / elsewhere) * 100, 1.5), 100);
  // Only claimed once it rounds to something worth claiming — an expensive chain against a small
  // plan can land under 2x, and "1x cheaper" would be a boast the bars themselves contradict.
  const ratio = gasSpent > 0 ? Math.round(elsewhere / gasSpent) : 0;
  const cheaperBy = ratio >= 2 ? ratio : null;

  /**
   * Nothing derived from the per-run cost may be shown until one is settled on. The gap matters:
   * the backstop constant is deliberately overstated on some chains, so a note that quoted it
   * while the headline still read "—" would put a number on screen that no one stands behind.
   */
  const pending = run.isLoading;
  const measured = run.source === "measured";
  const samples = run.cost.samples;
  const evidence = measured
    ? `Average of the last ${samples.toLocaleString("en-US")} run${samples === 1 ? "" : "s"} settled on this network`
    : run.source === "live"
      ? `Live estimate: ${run.gasPriceGwei?.toFixed(2) ?? "—"} gwei x ${(Number(run.gasUnits) / 1000).toFixed(0)}k gas, ${run.gasUnitsSource === "measured" ? "measured" : "seeded"} gas units`
      : "No measurement or live gas price available for this network yet";

  return (
    <div className="ec-receipt">
      <div className="ec-picker">
        <div className="ec-tabs" role="tablist" aria-label="Example DCA plan">
          {PLANS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={p.id === planId}
              className={`ec-tab ${p.id === planId ? "ec-tab-on" : ""}`}
              onClick={() => setPlanId(p.id)}
            >
              {p.tab}
            </button>
          ))}
        </div>

        <div className="ec-tabs ec-tabs-net" role="tablist" aria-label="Network to price this plan on">
          {networks.map((n) => {
            const open = openIds.has(n.chainId);
            return (
              <button
                key={n.chainId}
                type="button"
                role="tab"
                aria-selected={n.chainId === active}
                disabled={!open}
                title={open ? undefined : `${n.name} is not accepting new plans right now`}
                className={`ec-tab ec-tab-net ${n.chainId === active ? "ec-tab-on" : ""} ${
                  open ? "" : "ec-tab-off"
                }`}
                onClick={() => setChainId(n.chainId)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={n.icon} alt="" width={14} height={14} aria-hidden />
                {n.name}
              </button>
            );
          })}
        </div>
      </div>

      <p className="ec-plan-line">
        <strong>{usd(plan.amount)}</strong> every {plan.every} for <strong>1 year</strong> — that&apos;s{" "}
        <strong>{plan.runs.toLocaleString("en-US")} executions</strong>.
      </p>

      {/* What the plan costs to run */}
      <dl className="ec-lines">
        <div className="ec-line">
          <dt>
            You invest
            <span className="ec-line-note">your capital, into your own vault</span>
          </dt>
          <dd>{usd(capital)}</dd>
        </div>

        <div className="ec-line ec-line-good">
          <dt>
            Reaches the token
            <span className="ec-line-note">we never skim your DCA capital</span>
          </dt>
          <dd>
            {usd(capital)} <span className="ec-pct">100%</span>
          </dd>
        </div>

        <div className="ec-line">
          <dt>
            <span className="ec-dt-row">
              Cost of one run
              {pending ? null : (
                <span className={`ec-src ${measured ? "ec-src-measured" : ""}`} title={evidence}>
                  {measured ? `measured · ${samples.toLocaleString("en-US")} runs` : "estimated"}
                </span>
              )}
            </span>
            <span className="ec-line-note">
              {!pending && run.cost.minUsd != null && run.worstUsd > run.cost.minUsd
                ? `${usdPrecise(run.cost.minUsd)} – ${usdPrecise(run.worstUsd)} across those runs`
                : "the gas the relayer burned, billed at cost"}
            </span>
          </dt>
          <dd className="ec-cost">{pending ? "—" : usdPrecise(run.typicalUsd)}</dd>
        </div>

        <div className="ec-line">
          <dt>
            Gas for the whole plan
            <span className="ec-line-note">
              {plan.runs.toLocaleString("en-US")} runs x{" "}
              {pending ? "one run" : usdPrecise(run.typicalUsd)}
            </span>
          </dt>
          <dd className="ec-cost">{pending ? "—" : usd(gasSpent)}</dd>
        </div>

        <div className="ec-line ec-line-muted">
          <dt>
            Gas Tank to fund it
            {/* Identical to the row above until this network has a spread to size against — which
                is why the note says which of the two it is rather than claiming a worst case that
                no run has established. */}
            <span className="ec-line-note">
              {run.worstUsd > run.typicalUsd
                ? `sized on this network's worst run — unspent ${stable} is withdrawable`
                : `no run history yet, so sized on the estimate — unspent ${stable} is withdrawable`}
            </span>
          </dt>
          <dd>{pending ? "—" : usd(prepay)}</dd>
        </div>
      </dl>

      {/* The whole argument, in one comparison */}
      <div className="ec-compare">
        <p className="ec-compare-title">
          Cost to run this plan
          {!pending && cheaperBy != null ? (
            <span className="ec-compare-chip">{cheaperBy.toLocaleString("en-US")}x cheaper</span>
          ) : null}
        </p>

        <div className="ec-bar-row">
          <span className="ec-bar-label">SteadyStake</span>
          <div className="ec-bar-track">
            <span
              className="ec-bar ec-bar-good"
              style={{ width: pending ? "0%" : `${gasBarPct}%` }}
            />
          </div>
          <span className="ec-bar-value ec-bar-value-good">{pending ? "—" : usd(gasSpent)}</span>
        </div>

        <div className="ec-bar-row">
          <span className="ec-bar-label">1% fee elsewhere</span>
          <div className="ec-bar-track">
            <span className="ec-bar ec-bar-bad" style={{ width: "100%" }} />
          </div>
          <span className="ec-bar-value ec-bar-value-bad">{usd(elsewhere)}</span>
        </div>

        <p className="ec-compare-foot">
          Our cost scales with <strong>executions</strong>, not with how much you invest. A percentage fee does
          the opposite.
        </p>
      </div>

      <p className="ps-disclaimer">
        The plan amount is an example — the per-run cost is not, and 1% is a stand-in for typical
        recurring-buy fees rather than a quote from any venue.
      </p>
    </div>
  );
}

const FLOWS = [
  {
    theme: "mint" as const,
    tag: "Stays yours",
    title: "DCA capital",
    body: "Sits in your vault and converts into the token you chose. We never take custody and never take a cut of it.",
    meter: 100,
    meterLabel: "100% reaches the token",
  },
  {
    theme: "peach" as const,
    tag: "Prepaid",
    title: "Gas Tank",
    body: "One stablecoin balance, shared across every network. Each run deducts the gas the relayer actually burned — billed at cost, never a markup.",
    meter: 12,
    meterLabel: "Charged at cost, per execution",
  },
] as const;

const VALUE = [
  {
    theme: "mint" as const,
    icon: "📐",
    title: "Predictable by construction",
    body: "Cost is a formula, not a surprise. Users can price a year of automation before they fund it.",
    chip: "runs x cost",
  },
  {
    theme: "lavender" as const,
    icon: "📈",
    title: "Sticky, recurring demand",
    body: "DCA creates steady buy pressure and long-horizon users instead of one-off speculators.",
    chip: "Ecosystem growth",
  },
  {
    theme: "sky" as const,
    icon: "🔌",
    title: "Embeddable anywhere",
    body: "Any token, any EVM chain with a DEX router. Wallets and DeFi apps can ship recurring buy as a native feature.",
    chip: "Partnerships",
  },
  {
    theme: "peach" as const,
    icon: "💳",
    title: "Clear path to revenue",
    body: "Free tier plus paid auto-executed plans, VIP gas discounts, and premium AI strategy assistants.",
    chip: "Monetization",
  },
] as const;

export function Economics() {
  return (
    <section
      id="economics"
      className="section-pad border-t border-[var(--hero-muted)]/10 relative overflow-hidden bg-transparent"
    >
      <div className="relative z-1 mx-auto max-w-6xl px-4">
        <RevealOnScroll>
          <p className="ps-eyebrow mx-auto mb-4">Economics &amp; value</p>
          <h2 className="section-title mb-4 text-center">You pay for executions. Nothing else.</h2>
          <p className="section-title-sub mx-auto mb-12 text-center">
            There are exactly two balances in SteadyStake — and only one of them is a cost. Pick a plan and a
            network below: the bill is priced from what runs there really cost.
          </p>
        </RevealOnScroll>

        {/* The two balances */}
        <RevealOnScroll className="reveal-stagger">
          <div className="grid gap-6 md:grid-cols-2">
            {FLOWS.map((f) => (
              <div key={f.title} className="reveal-stagger-item">
                <Card3D>
                  <div className={`landing-card-sweet landing-card-${f.theme} ec-flow h-full p-6`}>
                    <div className="ec-flow-head">
                      <h3 className="ec-flow-title">{f.title}</h3>
                      <span className="ec-flow-tag">{f.tag}</span>
                    </div>
                    <p className="ec-flow-body">{f.body}</p>
                    <div className="ec-meter">
                      <span className="ec-meter-fill" style={{ width: `${f.meter}%` }} />
                    </div>
                    <p className="ec-meter-label">{f.meterLabel}</p>
                  </div>
                </Card3D>
              </div>
            ))}
          </div>
        </RevealOnScroll>

        {/* The worked example */}
        <RevealOnScroll>
          <Receipt />
        </RevealOnScroll>

        {/* Why that model is worth backing */}
        <RevealOnScroll className="reveal-stagger">
          <h3 className="ps-rows-title">Why the model compounds</h3>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {VALUE.map((v) => (
              <div key={v.title} className="reveal-stagger-item flex">
                <Card3D className="flex-1">
                  <div className={`landing-card-sweet landing-card-${v.theme} ec-value h-full p-6`}>
                    <span className="landing-tile" aria-hidden>
                      {v.icon}
                    </span>
                    <h4 className="ec-value-title">{v.title}</h4>
                    <p className="ec-value-body">{v.body}</p>
                    <span className="ec-value-chip">{v.chip}</span>
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
