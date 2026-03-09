import { NextRequest, NextResponse } from "next/server";

/** CoinGecko asset platform ids (free API, no key required). */
const COINGECKO_PLATFORM: Partial<Record<number, string>> = {
  1: "ethereum",
  8453: "base",
  84532: "base",
  11155111: "ethereum", // Sepolia uses mainnet platform for some tokens
  56: "binance-smart-chain",
  137: "polygon-pos",
  2222: "kava",
};

/** Moralis chain param for metadata API. */
const MORALIS_CHAIN: Partial<Record<number, string>> = {
  1: "eth",
  8453: "base",
  84532: "base_sepolia",
  11155111: "sepolia",
  56: "bsc",
  137: "polygon",
  2222: "kava",
};

const MORALIS_METADATA_URL = "https://deep-index.moralis.io/api/v2.2/erc20/metadata";

/**
 * GET /api/token-logo-url?chainId=8453&address=0x...
 * Returns { logoUrl: string | null }. Tries CoinGecko (free) first, then Moralis if API key is set.
 */
export async function GET(request: NextRequest) {
  const chainIdParam = request.nextUrl.searchParams.get("chainId");
  const address = request.nextUrl.searchParams.get("address");
  const chainId = chainIdParam ? parseInt(chainIdParam, 10) : NaN;

  if (!address || typeof address !== "string" || address.length < 40) {
    return NextResponse.json({ error: "Missing or invalid address" }, { status: 400 });
  }
  const addr = address.startsWith("0x") ? address : `0x${address}`;

  let logoUrl: string | null = null;

  const platform = COINGECKO_PLATFORM[chainId];
  if (platform) {
    try {
      const coingeckoUrl = `https://api.coingecko.com/api/v3/coins/${platform}/contract/${addr.toLowerCase()}`;
      const res = await fetch(coingeckoUrl, {
        headers: { accept: "application/json" },
        next: { revalidate: 86400 },
      });
      if (res.ok) {
        const data = (await res.json()) as { image?: string | { small?: string; large?: string; thumb?: string } };
        const img = data?.image;
        if (typeof img === "string" && img.startsWith("http")) {
          logoUrl = img;
        } else if (img && typeof img === "object" && (img.large || img.small || img.thumb)) {
          logoUrl = (img.large ?? img.small ?? img.thumb) ?? null;
        }
      }
    } catch {
      // ignore, try Moralis
    }
  }

  if (!logoUrl) {
    const moralisChain = MORALIS_CHAIN[chainId];
    const apiKey = process.env.MORALIS_API_KEY ?? process.env.NEXT_PUBLIC_MORALIS_API_KEY ?? "";
    if (moralisChain && apiKey) {
      try {
        const moralisUrl = `${MORALIS_METADATA_URL}?chain=${encodeURIComponent(moralisChain)}&addresses=${encodeURIComponent(addr)}`;
        const res = await fetch(moralisUrl, {
          headers: { accept: "application/json", "X-API-Key": apiKey },
          next: { revalidate: 86400 },
        });
        if (res.ok) {
          const data = (await res.json()) as Array<{ logo?: string; thumbnail?: string }>;
          const first = Array.isArray(data) ? data[0] : null;
          const logo = first?.logo ?? first?.thumbnail;
          if (typeof logo === "string" && logo.startsWith("http")) {
            logoUrl = logo;
          }
        }
      } catch {
        // ignore
      }
    }
  }

  return NextResponse.json({ logoUrl });
}
