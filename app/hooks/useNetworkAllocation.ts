"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { SUPPORTED_CHAIN_IDS } from "@/config/chains-env";
import type {
  NetworkAllocationEntry,
  NetworkAllocationResponse,
  NetworkStatus,
} from "@/app/api/networks/route";

/** Long enough that navigating around does not re-ask, short enough that a pause lands quickly. */
const STALE_MS = 30_000;

export interface NetworkAllocation {
  /** Networks to show, in backend (display) order. Removed networks are already absent. */
  networks: NetworkAllocationEntry[];
  /** Chain IDs to show. */
  visibleChainIds: number[];
  /** Chain IDs a new plan can be created on. */
  planEnabledChainIds: number[];
  status: (chainId: number) => NetworkStatus;
  /** True when the operator has this network on hold: visible, but read-only. */
  isPaused: (chainId: number) => boolean;
  /** True when the network is shown at all. */
  isVisible: (chainId: number) => boolean;
  /** True when a new plan can be created here. */
  acceptsNewPlans: (chainId: number) => boolean;
  /** Operator's note for this network, if any — safe to render to users. */
  note: (chainId: number) => string | null;
  /** False while the first fetch is in flight; the fallback list is in use until then. */
  isLoaded: boolean;
  /** "static" means the backend could not be read and the build's own list is being shown. */
  source: NetworkAllocationResponse["source"];
}

/**
 * Which networks this deployment currently offers, and which of them are on hold.
 *
 * The build's NETWORK_TYPE decides which networks exist for the app at all (that is baked in at
 * build time — see config/chains-env.ts). This hook adds the operator's live decisions on top:
 * pausing a network keeps it visible but read-only, removing one hides it, and neither needs a
 * redeploy.
 *
 * Every predicate answers optimistically before the first response lands, so nothing the user can
 * already see disappears or locks up while this is loading.
 */
export function useNetworkAllocation(): NetworkAllocation {
  const { data, isSuccess } = useQuery<NetworkAllocationResponse>({
    queryKey: ["network-allocation"],
    queryFn: async () => {
      const response = await fetch("/api/networks", { headers: { accept: "application/json" } });
      if (!response.ok) throw new Error(`Network list unavailable (${response.status})`);
      return (await response.json()) as NetworkAllocationResponse;
    },
    staleTime: STALE_MS,
    refetchOnWindowFocus: true,
    // The route handler never fails on a backend outage — it answers with the build's own list — so
    // a rejection here means the frontend itself is unreachable and a retry storm would not help.
    retry: 1,
  });

  return useMemo(() => {
    const entries = data?.networks ?? [];
    const byChain = new Map(entries.map((entry) => [entry.chainId, entry]));
    const visible = entries.filter((entry) => entry.visible);

    /** Before the first response, treat the build's list as fully in service. */
    const pending = entries.length === 0;

    return {
      networks: visible,
      visibleChainIds: pending ? [...SUPPORTED_CHAIN_IDS] : visible.map((entry) => entry.chainId),
      planEnabledChainIds: pending
        ? [...SUPPORTED_CHAIN_IDS]
        : visible.filter((entry) => entry.acceptsNewPlans).map((entry) => entry.chainId),
      status: (chainId) => byChain.get(chainId)?.status ?? "enabled",
      isPaused: (chainId) => byChain.get(chainId)?.status === "paused",
      isVisible: (chainId) => (pending ? true : (byChain.get(chainId)?.visible ?? false)),
      acceptsNewPlans: (chainId) =>
        pending ? true : (byChain.get(chainId)?.acceptsNewPlans ?? false),
      note: (chainId) => byChain.get(chainId)?.note ?? null,
      isLoaded: isSuccess,
      source: data?.source ?? "static",
    };
  }, [data, isSuccess]);
}
