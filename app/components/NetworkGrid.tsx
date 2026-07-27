"use client";

import { useMemo } from "react";
import { Card3D } from "./Card3D";
import { useNetworkAllocation } from "@/app/hooks/useNetworkAllocation";
import type { NetworkStatus } from "@/app/api/networks/route";

/**
 * The four non-partner networks the landing page shows, keyed by chain ID.
 *
 * The chain ID is the load-bearing field: the badge on each tile is not a constant but the
 * operator's live allocation, read through /api/networks and keyed by chain ID. A tile that always
 * says "Live" is the one thing this grid must not be, because a paused network is exactly when a
 * visitor is deciding whether to start a plan on it.
 *
 * `theme` picks the card accent, and the badge borrows that accent for its dot — so for BNB and Kava
 * the accent has to be the chain's own brand colour, not a slot from the pastel set. Anything else
 * puts a green dot under a gold BNB mark and an orange one under Kava's coral.
 */
const NETWORKS = [
  { chainId: 56, name: "BNB Chain", iconUrl: "/bsc.svg", theme: "gold" },
  { chainId: 8453, name: "Base", iconUrl: "/base.svg", theme: "sky" },
  { chainId: 137, name: "Polygon", iconUrl: "/polygon.svg", theme: "lavender" },
  { chainId: 2222, name: "Kava", iconUrl: "/kava.svg", theme: "crimson" },
] as const;

/** Mirrors the wording the network switcher already uses, so the two never disagree on a pause. */
const STATUS_LABEL: Record<NetworkStatus, string> = {
  enabled: "Live",
  paused: "Paused",
  disabled: "Offline",
};

/** Out-of-service badges drop the card accent — see .nw-live-paused / .nw-live-off in globals.css. */
const STATUS_CLASS: Record<NetworkStatus, string> = {
  enabled: "",
  paused: " nw-live-paused",
  disabled: " nw-live-off",
};

function StatusBadge({ status, note }: { status: NetworkStatus; note: string | null }) {
  return (
    <span className={`nw-live${STATUS_CLASS[status]}`} title={note ?? undefined}>
      <span className="nw-live-dot" aria-hidden>
        <span className="nw-live-ping" />
      </span>
      {STATUS_LABEL[status]}
    </span>
  );
}

/**
 * The partner card's kicker, which carries the same pulsing dot as the grid tiles and therefore has
 * to carry the same truth: a live dot next to "Partner network" claims BOT Chain is executing.
 * The kicker text stays put — the status is appended only when it is not the expected one.
 */
export function NetworkLeadKicker({ chainId, label }: { chainId: number; label: string }) {
  const allocation = useNetworkAllocation();
  const status = allocation.status(chainId);
  const note = allocation.note(chainId);

  return (
    <span className={`nw-lead-kicker${STATUS_CLASS[status]}`} title={note ?? undefined}>
      <span className="nw-live-dot" aria-hidden>
        <span className="nw-live-ping" />
      </span>
      {status === "enabled" ? label : `${label} · ${STATUS_LABEL[status]}`}
    </span>
  );
}

/**
 * The network tiles, with each one's badge coming from the backend's allocation rather than from
 * this file. Removed networks drop out of the grid entirely; paused ones stay, because a visitor who
 * already has a plan on a paused chain is better served by seeing it held than by seeing it vanish.
 */
export function NetworkGrid() {
  const allocation = useNetworkAllocation();

  const tiles = useMemo(() => {
    const visible = NETWORKS.filter((network) => allocation.isVisible(network.chainId));
    // The same defence /api/networks applies to itself: if the allocation and this build disagree
    // about every network on the page, that is a configuration mismatch, not four removed chains.
    // An empty grid under a heading that says "live on five networks" reads as a broken page.
    return visible.length > 0 ? visible : NETWORKS;
  }, [allocation]);

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {tiles.map((item) => (
        <div key={item.name} className="reveal-stagger-item">
          <Card3D>
            <div className={`landing-card-sweet landing-card-${item.theme} nw-card h-full p-6`}>
              <span className="nw-logo">
                <img
                  src={item.iconUrl}
                  alt={item.name}
                  className="h-7 w-7 object-contain"
                  width={28}
                  height={28}
                />
              </span>
              <h3 className="nw-name">{item.name}</h3>
              <StatusBadge
                status={allocation.status(item.chainId)}
                note={allocation.note(item.chainId)}
              />
            </div>
          </Card3D>
        </div>
      ))}
    </div>
  );
}
