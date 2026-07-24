import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/native-price?chainId=677 -> { chainId, usd: number | null, source }
 *
 * The USD price of the token a chain's gas is actually paid in. The gas tank is denominated in
 * USDC but every fee the relayer pays is native, so this is the missing multiplier in
 * `per-run price = native price x (execution fee + record fee)` — the sum the tank is charged.
 *
 * Deliberately mirrors backend/src/run-executor.ts: the same NATIVE_PRICE_USD_<chainId> override,
 * checked before CoinGecko, and the same asset ids. The relayer prices runs with those values, so
 * quoting anything else here would show the user a breakdown that does not add up to what they
 * were charged. Keep the two lists in step.
 */

/** CoinGecko asset ids for native token price (USD). Testnets quote their mainnet token. */
const COINGECKO_IDS: Record<number, string> = {
  8453: "ethereum",
  84532: "ethereum",
  11155111: "ethereum",
  56: "binancecoin",
  137: "matic-network",
  2222: "kava",
  // CoinGecko's "bot" is BOT Chain's own coin (its entry describes the L1), and it now carries a
  // USD quote — but from a single thin market, and one that has disagreed sharply with the price
  // the per-run rate was set from. That is exactly why the UI names the source next to the number
  // and why NATIVE_PRICE_USD_677 / _968 wins: an operator-set price should beat a lone ticker.
  677: "bot",
  968: "bot",
};

/** Manual override per chain, for tokens no public feed quotes. Wins over CoinGecko. */
function priceOverride(chainId: number): number | null {
  const raw = process.env[`NATIVE_PRICE_USD_${chainId}`]?.trim();
  if (!raw) return null;
  const n = parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function GET(request: NextRequest) {
  const chainId = parseInt(request.nextUrl.searchParams.get("chainId") ?? "", 10);
  if (!Number.isFinite(chainId)) {
    return NextResponse.json({ error: "Missing or invalid chainId" }, { status: 400 });
  }

  const override = priceOverride(chainId);
  if (override != null) {
    return NextResponse.json({ chainId, usd: override, source: "override" });
  }

  const id = COINGECKO_IDS[chainId];
  if (!id) return NextResponse.json({ chainId, usd: null, source: null });

  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=usd`,
      // Cached at the edge: a per-run gas estimate does not need a fresh quote per modal open,
      // and the free CoinGecko tier rate-limits hard enough to return nothing if we ask per user.
      { headers: { accept: "application/json" }, next: { revalidate: 300 } },
    );
    if (!res.ok) return NextResponse.json({ chainId, usd: null, source: null });
    const data = (await res.json()) as Record<string, { usd?: number }>;
    const usd = data[id]?.usd;
    return NextResponse.json({
      chainId,
      usd: typeof usd === "number" && usd > 0 ? usd : null,
      source: typeof usd === "number" && usd > 0 ? "coingecko" : null,
    });
  } catch {
    return NextResponse.json({ chainId, usd: null, source: null });
  }
}
