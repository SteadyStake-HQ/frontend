"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { useContracts } from "@/app/hooks";
import { useDashboardStore } from "@/app/store/useDashboardStore";

/**
 * How fresh the numbers on screen are. A dot that breathes while a refresh is in flight, an age
 * once it lands, and — when the last refresh failed — a retry in place of the age, so a stale
 * dashboard never passes for a live one.
 */
export function DashboardSyncStatus() {
  const { address } = useAccount();
  const { chainId } = useContracts();
  const lastFetchedAt = useDashboardStore((s) => s.lastFetchedAt);
  const isRefreshing = useDashboardStore((s) => s.isRefreshing);
  const error = useDashboardStore((s) => s.error);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(id);
  }, []);

  if (error && !isRefreshing) {
    return (
      <button
        type="button"
        className="dx-sync dx-sync-error"
        title={error}
        onClick={() => void useDashboardStore.getState().fetchDashboardData({ address, chainId, force: true })}
      >
        <span className="dx-sync-dot" aria-hidden />
        Sync failed · retry
      </button>
    );
  }

  const age = lastFetchedAt ? Math.max(0, Math.round((now - lastFetchedAt) / 1000)) : null;
  const label = isRefreshing ? "Syncing" : age == null ? "—" : age < 10 ? "Live" : age < 60 ? `${age}s ago` : `${Math.floor(age / 60)}m ago`;

  return (
    <span
      className={`dx-sync${isRefreshing ? " is-busy" : ""}`}
      title={lastFetchedAt ? `Last synced ${new Date(lastFetchedAt).toLocaleTimeString()}` : undefined}
      aria-live="polite"
    >
      <span className="dx-sync-dot" aria-hidden />
      {label}
    </span>
  );
}
