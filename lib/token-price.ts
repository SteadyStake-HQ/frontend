/**
 * Server-side read of the backend's token prices.
 *
 * The backend is deliberately the only implementation of "what is this token worth" — the same
 * module stamps a price onto every executed buy (backend/src/token-price.ts), so a second copy of
 * the source list here would eventually disagree with the number recorded against a user's plan.
 * Both server callers go through this: `/api/token-price`, which the picker polls, and
 * `/api/plans/record`, which stamps the price of a wallet-signed run.
 */

/** One token's USD price. `usd: null` means no feed quotes it — an answer, not a failure. */
export interface TokenPriceQuote {
  /** Lowercased contract address this quote is for. */
  address: `0x${string}`;
  usd: number | null;
  /** Which feed answered: dexscreener, coingecko, botdex, or an operator override. */
  source: string | null;
  /** When the price was fetched, ISO. Null when there is no price. */
  at: string | null;
  /** True when every source is failing and this is the last known good price. */
  stale: boolean;
}

const SCHEDULER_API_URL =
  process.env.SCHEDULER_API_URL ??
  process.env.NEXT_PUBLIC_SCHEDULER_API_URL ??
  (process.env.NODE_ENV === "development" ? "http://127.0.0.1:3340" : "");

const BACKEND_TIMEOUT_MS = 8_000;

/** Matches the backend's own cap; a longer list is a bug in the caller, not a bigger request. */
export const MAX_PRICE_ADDRESSES = 60;

const ADDRESS_RE = /^0x[0-9a-f]{40}$/;

/** Lowercased, de-duplicated, capped — the address list the backend will accept. */
export function normalizePriceAddresses(values: readonly string[]): `0x${string}`[] {
  const seen = new Set<string>();
  for (const value of values) {
    const address = String(value ?? "").trim().toLowerCase();
    if (ADDRESS_RE.test(address)) seen.add(address);
  }
  return [...seen].slice(0, MAX_PRICE_ADDRESSES) as `0x${string}`[];
}

/**
 * USD prices for up to 60 tokens on one chain.
 *
 * Returns null when the backend could not be read at all, which callers report differently from an
 * empty answer: one is an outage, the other is a chain whose tokens no feed covers.
 *
 * `revalidateSeconds` collapses the burst several components make on mount. Pass 0 for a caller
 * that must not reuse a cached quote — recording a buy stamps a price against real money, so it
 * asks for the price as of now.
 */
export async function fetchTokenPrices(
  chainId: number,
  addresses: readonly string[],
  revalidateSeconds = 15,
): Promise<TokenPriceQuote[] | null> {
  const unique = normalizePriceAddresses(addresses);
  if (unique.length === 0) return [];
  if (!SCHEDULER_API_URL) return null;

  try {
    const response = await fetch(
      `${SCHEDULER_API_URL.replace(/\/$/, "")}/api/token-price` +
        `?chainId=${chainId}&addresses=${unique.join(",")}`,
      {
        headers: { accept: "application/json" },
        ...(revalidateSeconds > 0
          ? { next: { revalidate: revalidateSeconds } }
          : { cache: "no-store" as const }),
        signal: AbortSignal.timeout(BACKEND_TIMEOUT_MS),
      },
    );
    if (!response.ok) return null;

    const data = (await response.json()) as {
      prices?: Array<{
        address?: string;
        usd?: number | null;
        source?: string | null;
        at?: string | null;
        stale?: boolean;
      }>;
    };
    return (data?.prices ?? [])
      .map((price) => {
        const address = String(price?.address ?? "").toLowerCase();
        if (!ADDRESS_RE.test(address)) return null;
        const usd =
          typeof price?.usd === "number" && Number.isFinite(price.usd) && price.usd > 0
            ? price.usd
            : null;
        return {
          address: address as `0x${string}`,
          usd,
          source: typeof price?.source === "string" ? price.source : null,
          at: typeof price?.at === "string" ? price.at : null,
          stale: price?.stale === true,
        } satisfies TokenPriceQuote;
      })
      .filter((price): price is TokenPriceQuote => price !== null);
  } catch (error) {
    console.warn(`Token price: could not reach ${SCHEDULER_API_URL} for chain ${chainId}.`, error);
    return null;
  }
}

/** One token's USD price, or null when nothing quotes it or the backend is unreachable. */
export async function fetchTokenPriceUsd(
  chainId: number,
  address: string,
  revalidateSeconds = 15,
): Promise<number | null> {
  const prices = await fetchTokenPrices(chainId, [address], revalidateSeconds);
  return prices?.[0]?.usd ?? null;
}
