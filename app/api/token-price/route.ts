import { NextResponse } from "next/server";
import { isSupportedChainId } from "@/config/chains-env";
import { fetchTokenPrices, normalizePriceAddresses, type TokenPriceQuote } from "@/lib/token-price";

export type TokenPriceItem = TokenPriceQuote;

export interface TokenPriceResponse {
  /** "backend" when prices were read — including when they came back empty — else "unavailable". */
  source: "backend" | "unavailable";
  chainId: number;
  prices: TokenPriceItem[];
}

function unavailable(chainId: number): NextResponse {
  return NextResponse.json(
    { source: "unavailable", chainId, prices: [] } satisfies TokenPriceResponse,
    { headers: { "cache-control": "no-store" } },
  );
}

/**
 * GET /api/token-price?chainId=56&addresses=0xa,0xb -> { source, chainId, prices[] }
 *
 * What the tokens a plan can buy are worth in USD — the price the new-plan picker shows beside each
 * token, and the price the plan page compares a plan's buys against. Reads through to the backend,
 * which is the only implementation (see lib/token-price.ts for why).
 *
 * A price is the headline number on the picker but not a precondition for using it, so an
 * unreachable backend answers "unavailable" rather than an error: the picker then lists tokens with
 * no price beside them, which is the honest state and still lets a plan be created.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const chainId = Number(params.get("chainId"));
  if (!Number.isInteger(chainId) || chainId <= 0) {
    return NextResponse.json({ error: "chainId is required" }, { status: 400 });
  }

  const addresses = normalizePriceAddresses((params.get("addresses") ?? "").split(","));
  if (addresses.length === 0) {
    return NextResponse.json({ error: "addresses is required" }, { status: 400 });
  }

  // A chain this build cannot transact on is not one whose prices mean anything here.
  if (!isSupportedChainId(chainId)) return unavailable(chainId);

  const prices = await fetchTokenPrices(chainId, addresses);
  if (prices == null) return unavailable(chainId);

  return NextResponse.json({ source: "backend", chainId, prices } satisfies TokenPriceResponse);
}
