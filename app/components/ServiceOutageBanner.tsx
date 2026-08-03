"use client";

import { useEffect, useState } from "react";
import { useNetworkAllocation } from "@/app/hooks/useNetworkAllocation";

/**
 * The site-wide notice that the app is closed.
 *
 * It appears whenever the network allocation cannot be read, which is the answer that says which
 * networks are in service. Without it the app cannot tell a live network from a paused or retired
 * one, so every interactive path — connecting a wallet, switching networks, opening the dashboard,
 * starting a plan — is disabled for as long as this is up. The marketing pages still render: there
 * is nothing unsafe about reading them, and blanking the site would tell a visitor less than this
 * does.
 *
 * Short by design (see the app's own rule about prose): a label, a state chip, and one action. The
 * longer explanation lives on the hover tip rather than in a paragraph nobody finishes.
 *
 * It clears itself — `useNetworkAllocation` keeps polling while closed — so the button is for people
 * who would rather not wait.
 */
export function ServiceOutageBanner() {
  const allocation = useNetworkAllocation();
  const [mounted, setMounted] = useState(false);

  // The allocation is client-only state; rendering the banner during hydration would make the
  // server and client markup disagree on every page.
  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  const [reloading, setReloading] = useState(false);
  const visible = mounted && allocation.isUnavailable;

  /**
   * The banner is fixed and the header is absolutely positioned at the top of the viewport, so
   * neither is pushed by the other in normal flow. This class on <html> moves both, and is removed
   * the moment the service answers — including on unmount, so a route change cannot strand it.
   */
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("ss-outage-open", visible);
    return () => root.classList.remove("ss-outage-open");
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="ss-outage" role="status" aria-live="polite">
      <span className="ss-outage-body">
        <span className="ss-outage-dot" aria-hidden />
        <strong className="ss-outage-title">Service unavailable</strong>
        <span
          className="ss-outage-note"
          title={
            "We can't reach the service that says which networks are in service, so wallet " +
            "connection, network switching and the dashboard are closed. Your plans and funds are " +
            "untouched — this is a connection problem on our side, not a change to your account."
          }
        >
          Wallet and dashboard are closed until it responds.
        </span>
      </span>

      <span className="ss-outage-actions">
        <span className="ss-outage-chip">Retrying</span>
        <button
          type="button"
          className="ss-outage-retry"
          onClick={() => {
            setReloading(true);
            window.location.reload();
          }}
          disabled={reloading}
        >
          {reloading ? "Reloading…" : "Reload"}
        </button>
      </span>
    </div>
  );
}
