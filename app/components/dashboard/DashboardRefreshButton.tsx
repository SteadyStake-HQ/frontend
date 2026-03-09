"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useContracts } from "@/app/hooks";
import { useDashboardStore } from "@/app/store/useDashboardStore";

export function DashboardRefreshButton() {
  const { address } = useAccount();
  const { chainId } = useContracts();
  const [isRefreshing, setIsRefreshing] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        setIsRefreshing(true);
        await useDashboardStore.getState().fetchDashboardData({ address, chainId, force: true });
        setTimeout(() => setIsRefreshing(false), 400);
      }}
      title="Refresh Dashboard"
      aria-label="Refresh dashboard data"
      className="inline-flex items-center justify-center rounded-lg p-2 text-[var(--hero-muted)] transition-colors hover:bg-[var(--hero-muted)]/10 hover:text-[var(--hero-primary)] disabled:opacity-50"
      disabled={isRefreshing}
    >
      <svg className={`h-5 w-5 ${isRefreshing ? "animate-spin" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
        <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
      </svg>
    </button>
  );
}
