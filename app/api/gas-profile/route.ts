import { NextRequest, NextResponse } from "next/server";
import { getSeedGasUnitsPerRun } from "@/config/gas-cost-env";

const SCHEDULER_API_URL =
  process.env.SCHEDULER_API_URL ??
  process.env.NEXT_PUBLIC_SCHEDULER_API_URL ??
  (process.env.NODE_ENV === "development" ? "http://127.0.0.1:3340" : "");

export const dynamic = "force-dynamic";

/** What the last runs on a network were charged, in dollars. Null where nothing has run yet. */
interface CostStats {
  samples: number;
  avgUsd: number | null;
  maxUsd: number | null;
  minUsd: number | null;
  lastUsd: number | null;
  crossChainSamples: number;
  crossChainAvgUsd: number | null;
  sameChainAvgUsd: number | null;
}

const NO_COST_STATS: CostStats = {
  samples: 0,
  avgUsd: null,
  maxUsd: null,
  minUsd: null,
  lastUsd: null,
  crossChainSamples: 0,
  crossChainAvgUsd: null,
  sameChainAvgUsd: null,
};

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * GET /api/gas-profile?chainId=677
 *   -> { chainId, gasUnitsPerRun, samples, source, updatedAt, cost: { avgUsd, maxUsd, … } }
 *
 * What a run on a chain burns and what it was charged, measured by the relayer from its own
 * receipts rather than tabulated here (backend/src/gas-profile.ts). Nothing sets a per-run price
 * any more — a run is billed the gas it burned — so this is where the app gets both the estimate
 * it shows before a run and the average and worst case it shows from the runs already made.
 *
 * Never fails: an unreachable backend falls back to the seed gas for that chain with no cost
 * statistics, so the modal shows a defensible estimate instead of a blank. `source` says which it
 * is — "measured" is drawn from real runs, "seed" means no run has been observed on this chain yet.
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
    cost: NO_COST_STATS,
  };

  if (!SCHEDULER_API_URL) return NextResponse.json(seed);

  try {
    const response = await fetch(
      `${SCHEDULER_API_URL.replace(/\/$/, "")}/api/gas-profile?chainId=${encodeURIComponent(chainId)}`,
      // The relayer only revises these figures when a run completes, so a short cache costs no
      // accuracy and keeps a modal reopened repeatedly off the backend.
      { headers: { accept: "application/json" }, next: { revalidate: 60 } },
    );
    if (!response.ok) return NextResponse.json(seed);
    const data = (await response.json()) as {
      gasUnitsPerRun?: number;
      samples?: number;
      source?: "measured" | "seed";
      updatedAt?: string | null;
      cost?: Partial<CostStats>;
    };
    const units = data?.gasUnitsPerRun;
    if (typeof units !== "number" || !Number.isFinite(units) || units <= 0) {
      return NextResponse.json(seed);
    }
    const cost = data.cost ?? {};
    return NextResponse.json({
      chainId,
      gasUnitsPerRun: Math.round(units),
      samples: typeof data.samples === "number" ? data.samples : 0,
      source: data.source === "measured" ? "measured" : "seed",
      updatedAt: data.updatedAt ?? null,
      cost: {
        samples: typeof cost.samples === "number" ? cost.samples : 0,
        avgUsd: num(cost.avgUsd),
        maxUsd: num(cost.maxUsd),
        minUsd: num(cost.minUsd),
        lastUsd: num(cost.lastUsd),
        crossChainSamples: typeof cost.crossChainSamples === "number" ? cost.crossChainSamples : 0,
        crossChainAvgUsd: num(cost.crossChainAvgUsd),
        sameChainAvgUsd: num(cost.sameChainAvgUsd),
      } satisfies CostStats,
    });
  } catch {
    return NextResponse.json(seed);
  }
}
