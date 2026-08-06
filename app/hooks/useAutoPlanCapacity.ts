"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount } from "wagmi";

export interface AutoPlanCapacity {
  wallet: string;
  tier: "starter" | "plus" | "pro" | "institutional";
  /** Base Auto Execution slots per supported network; null means unlimited (institutional). */
  baseLimitPerNetwork: number | null;
  /** Highest reward-card bonus held (0–3). */
  nftBonus: number;
  /** Bonus slots already used as excess across all networks. */
  usedNftSlots: number;
  /** Bonus slots still available globally. */
  availableNftSlots: number;
  perNetwork: Array<{ chainId: number; active: number; baseLimit: number | null; excess: number }>;
}

/**
 * Reads the connected wallet's Auto Execution Plan capacity (blueprint §15.2) from the backend via
 * this app's /api/capacity proxy. Only meaningful once a wallet is connected; returns null capacity
 * otherwise. Kept dependency-light (no react-query key coupling) since it is a small, on-demand read.
 */
export function useAutoPlanCapacity() {
  const { address, isConnected } = useAccount();
  const [capacity, setCapacity] = useState<AutoPlanCapacity | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!isConnected || !address) {
      setCapacity(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/capacity?wallet=${address}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Could not read capacity.");
      }
      setCapacity(data as AutoPlanCapacity);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not read capacity.");
      setCapacity(null);
    } finally {
      setLoading(false);
    }
  }, [address, isConnected]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { capacity, loading, error, refetch };
}
