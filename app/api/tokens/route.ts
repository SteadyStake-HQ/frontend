import { NextResponse } from "next/server";
import { isSupportedChainId } from "@/config/chains-env";

const SCHEDULER_API_URL =
  process.env.SCHEDULER_API_URL ??
  process.env.NEXT_PUBLIC_SCHEDULER_API_URL ??
  (process.env.NODE_ENV === "development" ? "http://127.0.0.1:3340" : "");

export const dynamic = "force-dynamic";

/** One token the app may offer as a plan's target. Mirrors the backend's TokenView. */
export interface TokenListItem {
  address: `0x${string}`;
  symbol: string;
  name: string;
  decimals: number;
  logoUrl: string | null;
}

export interface TokenListResponse {
  /**
   * "backend" when the operator's list was read — including when it was read and found empty —
   * and "unavailable" when it could not be read at all.
   *
   * There is deliberately no third, permissive answer and no local fallback. A build-time list
   * would be a second source for something only the operator gets to decide, and while one existed
   * the picker kept offering tokens that had been removed from the dashboard.
   */
  source: "backend" | "unavailable";
  chainId: number;
  tokens: TokenListItem[];
}

const BACKEND_TIMEOUT_MS = 6_000;

interface BackendToken {
  address?: string;
  symbol?: string;
  name?: string;
  decimals?: number;
  logoUrl?: string | null;
}

function unavailable(chainId: number): NextResponse {
  return NextResponse.json(
    { source: "unavailable", chainId, tokens: [] } satisfies TokenListResponse,
    { headers: { "cache-control": "no-store" } },
  );
}

/**
 * GET /api/tokens?chainId=56 -> { source, chainId, tokens[] }
 *
 * The tokens a plan may buy on one network, as the operator has curated them on the backend
 * dashboard. This replaced a JSON file compiled into the bundle, so adding or removing a token is
 * now an operator action rather than a redeploy.
 */
export async function GET(request: Request) {
  const requested = Number(new URL(request.url).searchParams.get("chainId"));
  if (!Number.isInteger(requested) || requested <= 0) {
    return NextResponse.json({ error: "chainId is required" }, { status: 400 });
  }
  // A chain this build has no contracts, wagmi entry or explorer for is not one it could transact
  // on, whatever the backend lists for it.
  if (!isSupportedChainId(requested)) return unavailable(requested);

  if (!SCHEDULER_API_URL) {
    console.warn(
      "SCHEDULER_API_URL is not set: the token list cannot be read, so the app falls back to the " +
        "list compiled into this build. Set SCHEDULER_API_URL.",
    );
    return unavailable(requested);
  }

  try {
    const response = await fetch(
      `${SCHEDULER_API_URL.replace(/\/$/, "")}/api/tokens?chainId=${requested}`,
      // Short cache: a token list changes rarely, and an operator removing one can tolerate a few
      // seconds. The timeout matters more — the new-plan modal waits on this.
      {
        headers: { accept: "application/json" },
        next: { revalidate: 30 },
        signal: AbortSignal.timeout(BACKEND_TIMEOUT_MS),
      },
    );
    if (!response.ok) {
      console.warn(`Token list: backend answered ${response.status} for chain ${requested}.`);
      return unavailable(requested);
    }

    const data = (await response.json()) as { tokens?: BackendToken[] };
    const tokens = (data?.tokens ?? [])
      .map((token) => {
        const address = String(token?.address ?? "").toLowerCase();
        const decimals = Number(token?.decimals);
        if (!/^0x[0-9a-f]{40}$/.test(address)) return null;
        // Decimals decide what a plan actually spends, so a token whose decimals did not survive
        // the round trip is dropped rather than defaulted to 18.
        if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) return null;
        const symbol = typeof token?.symbol === "string" ? token.symbol.trim() : "";
        if (!symbol) return null;
        return {
          address: address as `0x${string}`,
          symbol,
          name: typeof token?.name === "string" && token.name.trim() ? token.name.trim() : symbol,
          decimals,
          logoUrl: typeof token?.logoUrl === "string" ? token.logoUrl : null,
        } satisfies TokenListItem;
      })
      .filter((token): token is TokenListItem => token !== null);

    // An empty list is passed through as a real answer, not folded into "unavailable": with no
    // local fallback these mean different things to the picker — a network whose list nobody has
    // imported yet, versus a backend nobody can currently reach — and it says so differently.
    return NextResponse.json({
      source: "backend",
      chainId: requested,
      tokens,
    } satisfies TokenListResponse);
  } catch (error) {
    console.warn(`Token list: could not reach ${SCHEDULER_API_URL} for chain ${requested}.`, error);
    return unavailable(requested);
  }
}
