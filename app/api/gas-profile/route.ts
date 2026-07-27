import { NextRequest, NextResponse } from "next/server";
import { getSeedGasUnitsPerRun } from "@/config/gas-cost-env";

const SCHEDULER_API_URL =
  process.env.SCHEDULER_API_URL ??
  process.env.NEXT_PUBLIC_SCHEDULER_API_URL ??
  (process.env.NODE_ENV === "development" ? "http://127.0.0.1:3340" : "");

export const dynamic = "force-dynamic";

/**
 * GET /api/gas-profile?chainId=677 -> { chainId, gasUnitsPerRun, samples, source, updatedAt }
 *
 * How much gas one run burns on a chain, measured by the relayer from its own receipts rather
 * than tabulated here (backend/src/gas-profile.ts). This is the third input to the per-run cost
 * the gas tank modal shows; gas price and token price are already read live.
 *
 * Never fails: an unreachable backend falls back to the seed for that chain, so the modal shows
 * a defensible number instead of a blank. `source` says which it is — "measured" is drawn from
 * real runs, "seed" means no run has been observed on this chain yet.
 */
export async function GET(request: NextRequest) {
  const chainId = parseInt(request.nextUrl.searchParams.get("chainId") ?? "", 10);
  if (!Number.isFinite(chainId)) {
    return NextResponse.json({ error: "Missing or invalid chainId" }, { status: 400 });
  }

  const seed = {
    chainId,
    gasUnitsPerRun: Number(getSeedGasUnitsPerRun(chainId)),
    samples: 0,
    source: "seed" as const,
    updatedAt: null,
  };

  if (!SCHEDULER_API_URL) return NextResponse.json(seed);

  try {
    const response = await fetch(
      `${SCHEDULER_API_URL.replace(/\/$/, "")}/api/gas-profile?chainId=${encodeURIComponent(chainId)}`,
      // The relayer only revises this figure when a run completes, so a short cache costs no
      // accuracy and keeps a modal reopened repeatedly off the backend.
      { headers: { accept: "application/json" }, next: { revalidate: 60 } },
    );
    if (!response.ok) return NextResponse.json(seed);
    const data = (await response.json()) as {
      gasUnitsPerRun?: number;
      samples?: number;
      source?: "measured" | "seed";
      updatedAt?: string | null;
    };
    const units = data?.gasUnitsPerRun;
    if (typeof units !== "number" || !Number.isFinite(units) || units <= 0) {
      return NextResponse.json(seed);
    }
    return NextResponse.json({
      chainId,
      gasUnitsPerRun: Math.round(units),
      samples: typeof data.samples === "number" ? data.samples : 0,
      source: data.source === "measured" ? "measured" : "seed",
      updatedAt: data.updatedAt ?? null,
    });
  } catch {
    return NextResponse.json(seed);
  }
}
