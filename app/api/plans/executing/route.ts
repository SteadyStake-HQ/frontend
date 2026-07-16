import { NextRequest, NextResponse } from "next/server";

const SCHEDULER_API_URL =
  process.env.SCHEDULER_API_URL ??
  process.env.NEXT_PUBLIC_SCHEDULER_API_URL ??
  (process.env.NODE_ENV === "development" ? "http://127.0.0.1:3340" : "");

export const dynamic = "force-dynamic";

/**
 * Reports a wallet-signed execution to the backend so the operator dashboard shows the plan as
 * executing too. Keeps the scheduler URL server-side, matching the other scheduler proxies.
 */
export async function POST(request: NextRequest) {
  if (!SCHEDULER_API_URL) {
    return NextResponse.json(
      { ok: false, error: "Backend scheduler is unavailable." },
      { status: 503 },
    );
  }

  try {
    const body = await request.json();
    const response = await fetch(
      `${SCHEDULER_API_URL.replace(/\/$/, "")}/api/plans/executing`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      },
    );
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("[plans/executing]", error);
    return NextResponse.json(
      { ok: false, error: "Failed to reach the backend scheduler." },
      { status: 503 },
    );
  }
}
