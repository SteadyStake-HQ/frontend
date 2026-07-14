"use client";

import { useState } from "react";
import { RevealOnScroll } from "./RevealOnScroll";
import { Card3D } from "./Card3D";

/** Default gas cost per execution (USDC). Configurable per network — see config/gas-cost-env.ts. */
const COST_PER_RUN = 0.01;
/** We ask users to hold runs x cost x this, so a volatile network can never strand a plan. */
const GAS_BUFFER = 3;
/** Illustrative recurring-buy fee charged by a typical centralized venue. */
const COMPARISON_FEE_RATE = 0.01;

const PLANS = [
  { id: "daily", tab: "Daily", every: "day", amount: 10, runs: 90, span: "90 days" },
  { id: "weekly", tab: "Weekly", every: "week", amount: 50, runs: 52, span: "1 year" },
  { id: "monthly", tab: "Monthly", every: "month", amount: 200, runs: 12, span: "1 year" },
] as const;

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

function Receipt() {
  const [planId, setPlanId] = useState<(typeof PLANS)[number]["id"]>("weekly");
  const plan = PLANS.find((p) => p.id === planId)!;

  const capital = plan.amount * plan.runs;
  const gasSpent = plan.runs * COST_PER_RUN;
  const gasHeld = gasSpent * GAS_BUFFER;
  const elsewhere = capital * COMPARISON_FEE_RATE;
  const gasBarPct = Math.max((gasSpent / elsewhere) * 100, 1.5);

  return (
    <div className="ec-receipt">
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

      <p className="ec-plan-line">
        <strong>{usd(plan.amount)}</strong> every {plan.every} for <strong>{plan.span}</strong> — that&apos;s{" "}
        <strong>{plan.runs} executions</strong>.
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
            Gas actually spent
            <span className="ec-line-note">
              {plan.runs} runs x {usd(COST_PER_RUN)}
            </span>
          </dt>
          <dd className="ec-cost">{usd(gasSpent)}</dd>
        </div>

        <div className="ec-line ec-line-muted">
          <dt>
            Gas Tank you hold
            <span className="ec-line-note">{GAS_BUFFER}x safety buffer — unspent USDC is withdrawable</span>
          </dt>
          <dd>{usd(gasHeld)}</dd>
        </div>
      </dl>

      {/* The whole argument, in one comparison */}
      <div className="ec-compare">
        <p className="ec-compare-title">Cost to run this plan</p>

        <div className="ec-bar-row">
          <span className="ec-bar-label">SteadyStake</span>
          <div className="ec-bar-track">
            <span className="ec-bar ec-bar-good" style={{ width: `${gasBarPct}%` }} />
          </div>
          <span className="ec-bar-value ec-bar-value-good">{usd(gasSpent)}</span>
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
        Illustrative. Gas is {usd(COST_PER_RUN)} per run by default and configured per network; the 1% comparison
        is a stand-in for typical recurring-buy fees, not a quote from any specific venue.
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
    body: "One USDC balance, shared across every network. Each run deducts a fixed amount and reimburses the relayer that paid the on-chain gas.",
    meter: 12,
    meterLabel: "Fixed cost per execution",
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
            There are exactly two balances in SteadyStake — and only one of them is a cost. Pick a plan below to
            see the whole bill.
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
