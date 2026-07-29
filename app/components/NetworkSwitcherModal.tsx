"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount, useConfig, useSwitchChain } from "wagmi";
import { CHAIN_ICON_URLS } from "@/config/wagmi";
import { CHAIN_NAMES } from "@/lib/constants";
import { useNetworkAllocation } from "@/app/hooks/useNetworkAllocation";

/**
 * The network switcher, driven by the operator's allocation rather than by the build.
 *
 * RainbowKit's own chain modal lists `wagmiConfig.chains`, which is fixed at build time from
 * NETWORK_TYPE and NEXT_PUBLIC_SUPPORTED_CHAIN_IDS — it has no way to know that a network has been
 * paused or removed since. This modal replaces it so that what the app *offers* is decided at
 * runtime by GET /api/networks, while wagmi keeps describing what the app is *able* to talk to.
 *
 * Paused networks are still reachable, in a separate group below the live ones. A pause stops new
 * plans and stops the relayer; it does not touch deposits or gas tank balances, and a user who
 * still has funds on a paused chain has to be able to switch there to get them out.
 *
 * When the allocation cannot be read at all, every row is disabled instead. A paused network is a
 * known state the operator has published — an unreadable list is not, and switching a wallet onto a
 * network nobody can vouch for is exactly what this modal exists to prevent.
 */

interface Row {
  chainId: number;
  name: string;
  iconUrl?: string;
  /** Offered as a network to use: the operator has it enabled. */
  offered: boolean;
  paused: boolean;
  note: string | null;
  /** Not selectable at all — the allocation is missing, so no network can be vouched for. */
  blocked: boolean;
}

function ChainAvatar({ name, iconUrl }: { name: string; iconUrl?: string }) {
  // The URL that failed, not a flag: a row whose icon changes then gets its own chance to load.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  if (!iconUrl || failedUrl === iconUrl) {
    return <span className="nsw-icon nsw-icon-fallback">{name.slice(0, 1).toUpperCase()}</span>;
  }
  return (
    <span className="nsw-icon">
      <img src={iconUrl} alt="" width={28} height={28} onError={() => setFailedUrl(iconUrl)} />
    </span>
  );
}

/** Rendered only while open — see NetworkSwitcherProvider — so its state starts clean every time. */
export function NetworkSwitcherModal({ onClose }: { onClose: () => void }) {
  const { chains } = useConfig();
  const { chain: currentChain, isConnected } = useAccount();
  const { switchChain, isPending } = useSwitchChain();
  const allocation = useNetworkAllocation();
  const [pendingChainId, setPendingChainId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * No network may be selected: either the allocation could not be read, or it has not answered
   * yet. Both are states in which the modal cannot say what is in service, so it offers nothing —
   * the rows stay listed and visible so the user can see what the app normally supports, and so the
   * current network still reads back correctly.
   */
  const blocked = allocation.isUnavailable || allocation.isLoading;

  const rows = useMemo<Row[]>(() => {
    const byId = new Map(chains.map((c) => [c.id, c]));
    /**
     * The backend's order once it has answered, the build's order until then. Removed networks are
     * already absent from the allocation list, so they never reach this modal.
     */
    const ids = allocation.networks.length
      ? allocation.networks.map((n) => n.chainId).filter((id) => byId.has(id))
      : chains.map((c) => c.id);
    // A network the operator removed while the user was standing on it: keep one row so the wallet's
    // current position is never unexplained, and so switching away is one click.
    if (currentChain && byId.has(currentChain.id) && !ids.includes(currentChain.id)) {
      ids.push(currentChain.id);
    }
    return ids.map((chainId) => {
      const chain = byId.get(chainId)!;
      const iconUrl =
        CHAIN_ICON_URLS[chainId] ??
        ("iconUrl" in chain && typeof chain.iconUrl === "string" ? chain.iconUrl : undefined);
      return {
        chainId,
        // Local name first, allocation second. Every chain that reaches this list is one the build
        // has a wagmi entry for, so a name is always available locally — and it is the same one the
        // header and the wallet show. Trusting the response's name here is what let a placeholder
        // from an unreachable backend render as "Chain 677".
        name:
          CHAIN_NAMES[chainId] ??
          chain.name ??
          allocation.networks.find((n) => n.chainId === chainId)?.name ??
          `Chain ${chainId}`,
        iconUrl,
        offered: !blocked && allocation.acceptsNewPlans(chainId),
        paused: allocation.isPaused(chainId),
        note: allocation.note(chainId),
        blocked,
      };
    });
  }, [chains, currentChain, allocation, blocked]);

  // With nothing to group by — no row is offered — one flat list under the notice reads as "none of
  // these are available right now", where an "Out of service" heading would claim the operator took
  // every network down.
  const live = blocked ? [] : rows.filter((r) => r.offered);
  const outOfService = blocked ? [] : rows.filter((r) => !r.offered);

  const handleSwitch = useCallback(
    (chainId: number) => {
      if (chainId === currentChain?.id) return onClose();
      setError(null);
      setPendingChainId(chainId);
      switchChain(
        { chainId },
        {
          onSuccess: () => {
            setPendingChainId(null);
            onClose();
          },
          onError: (e) => {
            setPendingChainId(null);
            setError(e.message.split("\n")[0] || "Could not switch network.");
          },
        },
      );
    },
    [currentChain?.id, onClose, switchChain],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const renderRow = (row: Row) => {
    const isCurrent = isConnected && row.chainId === currentChain?.id;
    const switching = pendingChainId === row.chainId;
    return (
      <button
        key={row.chainId}
        type="button"
        onClick={() => handleSwitch(row.chainId)}
        disabled={row.blocked || (isPending && !switching)}
        aria-disabled={row.blocked || undefined}
        className={`nsw-row${isCurrent ? " nsw-row-current" : ""}${row.offered ? "" : " nsw-row-off"}`}
        title={row.blocked ? "Network availability is unknown right now" : (row.note ?? undefined)}
      >
        <ChainAvatar name={row.name} iconUrl={row.iconUrl} />
        <span className="nsw-name">
          {row.name}
          {row.note ? <span className="nsw-note">{row.note}</span> : null}
        </span>
        {switching ? (
          <span className="nsw-state">
            <span className="nsw-spinner" aria-hidden />
            Confirm in wallet
          </span>
        ) : row.blocked ? (
          isCurrent ? (
            <span className="nsw-state">Connected</span>
          ) : (
            <span className="nsw-badge">Unavailable</span>
          )
        ) : isCurrent ? (
          <span className="nsw-state nsw-state-live">
            Connected
            <span className="nsw-dot" aria-hidden />
          </span>
        ) : row.paused ? (
          <span className="nsw-badge">Paused</span>
        ) : row.offered ? null : (
          <span className="nsw-badge">Offline</span>
        )}
      </button>
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="network-switcher-title"
      className="dm-overlay"
      onClick={onClose}
    >
      <div className="dm-veil" aria-hidden>
        <span className="dm-veil-bloom dm-veil-bloom-a" />
        <span className="dm-veil-bloom dm-veil-bloom-b" />
      </div>

      <div className="nsw-shell" onClick={(e) => e.stopPropagation()}>
        <div className="nsw-head">
          <h2 id="network-switcher-title" className="nsw-title">
            Switch Networks
          </h2>
          <button type="button" onClick={onClose} className="nsw-close" aria-label="Close">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="nsw-body">
          {blocked && (
            <p className="nsw-notice">
              {allocation.isLoading
                ? "Checking which networks are in service…"
                : "We can't reach the service that says which networks are in service, so no network can be selected right now. Retrying automatically."}
            </p>
          )}

          {blocked ? rows.map(renderRow) : live.map(renderRow)}

          {!blocked && outOfService.length > 0 && (
            <>
              <p className="nsw-group-label">Out of service</p>
              {outOfService.map(renderRow)}
            </>
          )}

          {rows.length === 0 && (
            <p className="nsw-empty">No networks are currently available. Please check back shortly.</p>
          )}

          {error && <p className="nsw-error">{error}</p>}
        </div>
      </div>
    </div>
  );
}
