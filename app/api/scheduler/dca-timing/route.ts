import { NextRequest, NextResponse } from "next/server";

const SCHEDULER_API_URL =
  process.env.SCHEDULER_API_URL ??
  process.env.NEXT_PUBLIC_SCHEDULER_API_URL ??
  (process.env.NODE_ENV === "development" ? "http://127.0.0.1:3340" : "");

export const dynamic = "force-dynamic";

/**
 * Proxies the backend's authoritative DCA timing snapshot. This keeps the
 * scheduler URL server-side and ensures countdown responses are never cached.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const user = searchParams.get("user")?.trim() ?? "";
  const chainId = searchParams.get("chainId")?.trim() ?? "";

  if (!SCHEDULER_API_URL || !user || !chainId) {
    return NextResponse.json(
      { ok: false, error: "Backend scheduler timing is unavailable." },
      { status: 503 },
    );
  }

  try {
    const url =
      `${SCHEDULER_API_URL.replace(/\/$/, "")}/api/plans/timing` +
      `?user=${encodeURIComponent(user)}&chainId=${encodeURIComponent(chainId)}`;
    const response = await fetch(url, { cache: "no-store" });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("[scheduler/dca-timing]", error);
    return NextResponse.json(
      { ok: false, error: "Failed to reach the backend scheduler." },
      { status: 503 },
    );
  }
}
