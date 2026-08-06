import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/capacity/reserve { wallet, targetChainId, planIntentId? }
 *
 * Proxies the backend's bonus-slot reservation (blueprint §15.6 / §16). The backend reserves a slot
 * under a serializable transaction and returns a signed EIP-712 capacity permit. The signing key
 * lives only on the backend, which is why this must proxy rather than sign here.
 */
const SCHEDULER_API_URL =
  process.env.SCHEDULER_API_URL ??
  process.env.NEXT_PUBLIC_SCHEDULER_API_URL ??
  (process.env.NODE_ENV === "development" ? "http://127.0.0.1:3340" : "");

export async function POST(request: NextRequest) {
  if (!SCHEDULER_API_URL) {
    return NextResponse.json({ ok: false, error: "Capacity service is not configured." }, { status: 503 });
  }
  try {
    const body = await request.json();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(
      `${SCHEDULER_API_URL.replace(/\/$/, "")}/api/steadystake/auto-plan-capacity/reserve`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
        cache: "no-store",
      },
    ).finally(() => clearTimeout(timer));
    const text = await response.text();
    return new NextResponse(text, {
      status: response.status,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Reservation failed." },
      { status: 502 },
    );
  }
}
