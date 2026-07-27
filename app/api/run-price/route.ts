import { NextRequest, NextResponse } from "next/server";

const SCHEDULER_API_URL =
  process.env.SCHEDULER_API_URL ??
  process.env.NEXT_PUBLIC_SCHEDULER_API_URL ??
  (process.env.NODE_ENV === "development" ? "http://127.0.0.1:3340" : "");

export const dynamic = "force-dynamic";

/**
 * GET /api/run-price?chainId=677 -> { usdc6, usd, source } | { usdc6: null }
 *
 * The flat rate an operator has set for this network on the backend dashboard, which is the
 * amount the relayer debits from the tank per run (backend/src/run-price.ts). Read-only: prices
 * are changed from the operator dashboard behind ADMIN_API_TOKEN, never through the user-facing
 * app, so this route deliberately proxies GET and nothing else.
 *
 * Nulls rather than errors on every failure. No operator price set is the normal case, and the
 * caller already falls back to the GasTank's own gasCostPerExecutionUsdc6 — an unreachable backend
 * must land on that same path rather than blanking the price the user is quoted.
 */
export async function GET(request: NextRequest) {
  const chainId = parseInt(request.nextUrl.searchParams.get("chainId") ?? "", 10);
  if (!Number.isFinite(chainId)) {
    return NextResponse.json({ error: "Missing or invalid chainId" }, { status: 400 });
  }

  const none = { chainId, usdc6: null, usd: null, source: null };
  if (!SCHEDULER_API_URL) return NextResponse.json(none);

  try {
    const response = await fetch(
      `${SCHEDULER_API_URL.replace(/\/$/, "")}/api/run-price?chainId=${encodeURIComponent(chainId)}`,
      // Only an operator edit changes this, and the modal must not hold a user at a stale price
      // for long after one — a minute is short enough to be invisible, long enough to cache.
      { headers: { accept: "application/json" }, next: { revalidate: 60 } },
    );
    if (!response.ok) return NextResponse.json(none);
    const data = (await response.json()) as {
      manual?: { usdc6?: string; usd?: number | null } | null;
      source?: string;
    };

    // Only the operator-set price is forwarded. The contract price and the live estimate are read
    // directly by the app from the chain, and echoing the backend's copy of them would give the
    // modal two sources for one number.
    const usdc6 = data?.manual?.usdc6;
    if (typeof usdc6 !== "string" || !/^\d+$/.test(usdc6) || usdc6 === "0") {
      return NextResponse.json(none);
    }
    return NextResponse.json({
      chainId,
      usdc6,
      usd: typeof data.manual?.usd === "number" ? data.manual.usd : Number(usdc6) / 1e6,
      source: "manual" as const,
    });
  } catch {
    return NextResponse.json(none);
  }
}
