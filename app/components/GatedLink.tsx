"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useNetworkAllocation } from "@/app/hooks/useNetworkAllocation";

const OUTAGE_TITLE =
  "We can't reach the service that lists the available networks, so the dashboard is closed. " +
  "Retrying automatically.";

/**
 * A link into the app that stops being a link while the network allocation is unreachable.
 *
 * The dashboard already refuses to open in that state, so following one of these would only land a
 * visitor on the closed screen. Turning it off here says the same thing one step earlier, and keeps
 * the marketing page — which is still perfectly readable during an outage — from advertising a way
 * in that does not work.
 *
 * It renders as a plain `<span>` rather than a disabled button so it keeps whatever shape the call
 * site gave it; `aria-disabled` plus the title carry the reason.
 */
export function GatedLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const allocation = useNetworkAllocation();
  const [mounted, setMounted] = useState(false);

  // Client-only state: rendering the disabled form during hydration would make the server and
  // client markup disagree on the landing page.
  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  if (mounted && allocation.isUnavailable) {
    return (
      <span
        className={`${className ?? ""} pointer-events-none cursor-not-allowed opacity-50`}
        aria-disabled="true"
        title={OUTAGE_TITLE}
      >
        {children}
      </span>
    );
  }

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
