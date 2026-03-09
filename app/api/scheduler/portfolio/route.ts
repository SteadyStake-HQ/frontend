import { NextRequest, NextResponse } from "next/server";

const SCHEDULER_API_URL = process.env.SCHEDULER_API_URL ?? process.env.NEXT_PUBLIC_SCHEDULER_API_URL ?? "";

/**
 * GET /api/scheduler/portfolio?user=0x...&chainId=84532&limit=200
 * Proxies to backend GET /api/history/portfolio for portfolio value history (when all DCA plans ended).
 */
export async function GET(request: NextRequest) {
  if (!SCHEDULER_API_URL) {
    return NextResponse.json({ points: [] });
  }
  const { searchParams } = new URL(request.url);
  const user = searchParams.get("user")?.trim() ?? "";
  const chainId = searchParams.get("chainId")?.trim() ?? "";
  const limit = searchParams.get("limit") ?? "200";
  if (!user || !chainId) {
    return NextResponse.json({ points: [] });
  }
  try {
    const url = `${SCHEDULER_API_URL.replace(/\/$/, "")}/api/history/portfolio?user=${encodeURIComponent(user)}&chainId=${encodeURIComponent(chainId)}&limit=${encodeURIComponent(limit)}`;
    const res = await fetch(url, { next: { revalidate: 30 } });
    if (!res.ok) return NextResponse.json({ points: [] });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    console.error("[scheduler/portfolio]", e);
    return NextResponse.json({ points: [] });
  }
}
