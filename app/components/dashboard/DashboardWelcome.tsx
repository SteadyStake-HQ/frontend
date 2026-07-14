"use client";

import { useAccount } from "wagmi";
import { useDashboardStore } from "@/app/store/useDashboardStore";

const CYCLE_STEPS = [
  {
    label: "Plan",
    className: "dashboard-cycle-plan",
    path: "M7 3v3m10-3v3M4 9h16M6 5h12a2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2z",
  },
  {
    label: "Fund",
    className: "dashboard-cycle-fund",
    path: "M4 7.5h15a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2v-12a2 2 0 012-2h12M16 12h5v4h-5a2 2 0 010-4z",
  },
  {
    label: "Repeat",
    className: "dashboard-cycle-repeat",
    path: "M20 7v5h-5M4 17v-5h5M6.1 8A7 7 0 0118.5 6.5L20 8M4 16l1.5 1.5A7 7 0 0017.9 16",
  },
];

export function DashboardWelcome({ onAddPlan }: { onAddPlan: () => void }) {
  const { chain } = useAccount();
  const activePlanCount = useDashboardStore((state) => state.activePlanCount);
  const networkName = chain?.name ?? "your network";

  return (
    <section className="dashboard-welcome dashboard-welcome-compact" aria-labelledby="dashboard-title">
      <div className="dashboard-welcome-copy">
        <div className="dashboard-network-pill">
          <span className="dashboard-network-pulse" aria-hidden />
          {networkName}
        </div>
        <h1 id="dashboard-title" className="dashboard-title dashboard-title-compact">
          Your DCA. <span>On repeat.</span>
        </h1>
        <p className="dashboard-intro dashboard-intro-compact">
          Set the plan. Keep your keys. Let the schedule work.
        </p>
        <div className="dashboard-welcome-actions">
          <button
            type="button"
            onClick={onAddPlan}
            className="ss-btn ss-btn-primary dashboard-new-plan-btn"
          >
            <span className="dashboard-new-plan-icon" aria-hidden>
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 5v14M5 12h14" />
              </svg>
            </span>
            <span>{activePlanCount > 0 ? "New plan" : "Create a plan"}</span>
          </button>
          <span className="dashboard-action-note">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3l7 4v5c0 4.4-3 8.2-7 9-4-.8-7-4.6-7-9V7l7-4z" />
            </svg>
            Non-custodial
          </span>
        </div>
      </div>

      <div className="dashboard-cycle" aria-label="Plan, fund, and repeat">
        <span className="dashboard-cycle-halo" aria-hidden />
        <span className="dashboard-cycle-orbit" aria-hidden>
          <span className="dashboard-cycle-runner" />
        </span>
        <div className="dashboard-cycle-core">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 8.5A2.5 2.5 0 015.5 6H17a2 2 0 012 2v1M3 8.5v8A2.5 2.5 0 005.5 19H19a2 2 0 002-2v-6a2 2 0 00-2-2H5.5A2.5 2.5 0 013 8.5z" />
            <circle cx="16.5" cy="14" r="1.3" fill="currentColor" stroke="none" />
          </svg>
          <strong>Scheduled</strong>
          <span>You stay in control</span>
        </div>
        {CYCLE_STEPS.map((step) => (
          <div className={`dashboard-cycle-node ${step.className}`} key={step.label}>
            <span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d={step.path} />
              </svg>
            </span>
            <strong>{step.label}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
