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

/** While the list is unavailable, keep asking: this is what reopens the app once the backend is back. */
const RETRY_WHILE_CLOSED_MS = 15_000;

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
  /** The first fetch is still in flight. Nothing is decided yet — hold, do not gate. */
  isLoading: boolean;
  /** The allocation has been read successfully and the predicates below are the operator's answer. */
  isLoaded: boolean;
  /**
   * The list could not be read, so the app has no networks it can vouch for. Every predicate is
   * false while this is true and callers must close: no dashboard, no network selection.
   */
  isUnavailable: boolean;
  /** "unavailable" means the operator's allocation could not be read. */
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
 * Three states, and the difference between the last two is the whole point:
 *
 *   loading      — nothing is known yet. Every predicate answers optimistically so a user on a live
 *                  network never sees a gate flash on the way in; callers wait rather than gate.
 *   loaded       — the operator's answer, per network.
 *   unavailable  — the answer could not be read. Every predicate is false and the app closes. The
 *                  build's chain list is deliberately *not* used as a stand-in: it says what this
 *                  app can talk to, never what is in service, and offering a network on that basis
 *                  is how a retired chain gets a new plan created on it during an outage.
 */
export function useNetworkAllocation(): NetworkAllocation {
  const { data, isPending, isSuccess } = useQuery<NetworkAllocationResponse>({
    queryKey: ["network-allocation"],
    queryFn: async () => {
      const response = await fetch("/api/networks", { headers: { accept: "application/json" } });
      if (!response.ok) throw new Error(`Network list unavailable (${response.status})`);
      return (await response.json()) as NetworkAllocationResponse;
    },
    staleTime: STALE_MS,
    refetchOnWindowFocus: true,
    // A rejection here means the frontend's own route is unreachable, which a retry storm would not
    // help. One retry covers a blip; past that the app closes and the poll below reopens it.
    retry: 1,
    // The app is closed while the list is missing, so it has to notice on its own when it is back —
    // a user staring at the gate should not have to reload to be let in.
    refetchInterval: (query) =>
      query.state.data?.source === "backend" ? false : RETRY_WHILE_CLOSED_MS,
  });

  return useMemo(() => {
    const entries = data?.source === "backend" ? data.networks : [];
    const byChain = new Map(entries.map((entry) => [entry.chainId, entry]));
    const visible = entries.filter((entry) => entry.visible);

    /** Before the first answer lands, treat the build's list as fully in service. */
    const pending = isPending;
    /** Answered, but with nothing the app can offer. */
    const closed = !pending && entries.length === 0;

    return {
      networks: pending ? [] : visible,
      visibleChainIds: pending ? [...SUPPORTED_CHAIN_IDS] : visible.map((entry) => entry.chainId),
      planEnabledChainIds: pending
        ? [...SUPPORTED_CHAIN_IDS]
        : visible.filter((entry) => entry.acceptsNewPlans).map((entry) => entry.chainId),
      status: (chainId) =>
        pending ? "enabled" : (byChain.get(chainId)?.status ?? "disabled"),
      isPaused: (chainId) => byChain.get(chainId)?.status === "paused",
      isVisible: (chainId) => (pending ? true : (byChain.get(chainId)?.visible ?? false)),
      acceptsNewPlans: (chainId) =>
        pending ? true : (byChain.get(chainId)?.acceptsNewPlans ?? false),
      note: (chainId) => byChain.get(chainId)?.note ?? null,
      isLoading: pending,
      isLoaded: isSuccess && !closed,
      isUnavailable: closed,
      source: data?.source ?? "unavailable",
    };
  }, [data, isPending, isSuccess]);
}
