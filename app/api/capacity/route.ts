import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/capacity?wallet=0x…
 *
 * Proxies the SteadyStake backend's Auto Execution Plan capacity read (blueprint §15.2): the
 * wallet's membership base limit per network, its highest NFT reward-card bonus, how many bonus
 * slots are already used across chains, and how many remain. Kept server-side and proxied — the same
 * way this app reaches the backend for /api/networks and /api/gas-profile — so the browser never
 * needs the backend's address.
 */
const SCHEDULER_API_URL =
  process.env.SCHEDULER_API_URL ??
  process.env.NEXT_PUBLIC_SCHEDULER_API_URL ??
  (process.env.NODE_ENV === "development" ? "http://127.0.0.1:3340" : "");

export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get("wallet")?.trim() ?? "";
  if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    return NextResponse.json({ ok: false, error: "A valid wallet address is required." }, { status: 400 });
  }
  if (!SCHEDULER_API_URL) {
    return NextResponse.json({ ok: false, error: "Capacity service is not configured." }, { status: 503 });
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(
      `${SCHEDULER_API_URL.replace(/\/$/, "")}/api/steadystake/auto-plan-capacity?wallet=${encodeURIComponent(wallet)}`,
      { signal: controller.signal, cache: "no-store" },
    ).finally(() => clearTimeout(timer));
    const body = await response.text();
    return new NextResponse(body, {
      status: response.status,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Capacity read failed." },
      { status: 502 },
    );
  }
}
