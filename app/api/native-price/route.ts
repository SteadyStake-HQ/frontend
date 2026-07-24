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
  // BOT Chain mainnet. CoinGecko's "bot" is the fallback leg of the mainnet BOT fetch below;
  // the BOT Chain DEX pool price is tried first. (Testnet 968 is pinned — see STATIC_PRICE_USD.)
  677: "bot",
};

/**
 * Statically pinned USD prices. BOT Chain testnet (968) tBOT is a faucet token with no real
 * market, so a live feed either has no quote for it or — worse — hands back mainnet BOT's number,
 * which is a different token at a different price. Pinning it keeps the per-run breakdown stable
 * and unmistakably a testnet figure instead of silently borrowing the mainnet quote.
 */
const STATIC_PRICE_USD: Record<number, number> = {
  968: 130,
};

/**
 * BOT Chain mainnet (677) BOT price is fetched from two independent sources so a single outage
 * does not blank the quote (see fetchBotMainnetUsd): the chain's own DEX pool price for WBOT
 * first, CoinGecko's "bot" ticker as the safety net. This is WBOT's address on the DEX price graph.
 */
const BOT_MAINNET_PRICE_TOKEN = "0xD5452816194a3784dBa983426cCe7c122F4abd30";

/** BOT Chain DEX pool price for WBOT, in USD. Null on any failure so a fallback can take over. */
async function fetchBotDexUsd(): Promise<number | null> {
  try {
    const res = await fetch(
      `https://dex-wallet.botchain.ai/api/graph/price?token=${BOT_MAINNET_PRICE_TOKEN}`,
      { headers: { accept: "application/json" }, next: { revalidate: 300 } },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { success?: boolean; data?: { price?: string } };
    if (!json.success) return null;
    const usd = parseFloat(json.data?.price ?? "");
    return Number.isFinite(usd) && usd > 0 ? usd : null;
  } catch {
    return null;
  }
}

/** CoinGecko USD price for an asset id. Null on any failure so a fallback can take over. */
async function fetchCoingeckoUsd(id: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=usd`,
      // Cached at the edge: a per-run gas estimate does not need a fresh quote per modal open,
      // and the free CoinGecko tier rate-limits hard enough to return nothing if we ask per user.
      { headers: { accept: "application/json" }, next: { revalidate: 300 } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, { usd?: number }>;
    const usd = data[id]?.usd;
    return typeof usd === "number" && usd > 0 ? usd : null;
  } catch {
    return null;
  }
}

/** Mainnet BOT price with the DEX pool as primary and CoinGecko as fallback. */
async function fetchBotMainnetUsd(): Promise<{ usd: number | null; source: "botdex" | "coingecko" | null }> {
  const dex = await fetchBotDexUsd();
  if (dex != null) return { usd: dex, source: "botdex" };
  const cg = await fetchCoingeckoUsd(COINGECKO_IDS[677]);
  return { usd: cg, source: cg != null ? "coingecko" : null };
}

/** Manual override per chain, for tokens no public feed quotes. Wins over every source. */
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

  const staticUsd = STATIC_PRICE_USD[chainId];
  if (staticUsd != null) {
    return NextResponse.json({ chainId, usd: staticUsd, source: "static" });
  }

  if (chainId === 677) {
    const { usd, source } = await fetchBotMainnetUsd();
    return NextResponse.json({ chainId, usd, source });
  }

  const id = COINGECKO_IDS[chainId];
  if (!id) return NextResponse.json({ chainId, usd: null, source: null });
  const usd = await fetchCoingeckoUsd(id);
  return NextResponse.json({ chainId, usd, source: usd != null ? "coingecko" : null });
}
