"use client";

import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import type { TokenPriceItem, TokenPriceResponse } from "@/app/api/token-price/route";

/**
 * How long a quote is served before it is refetched. Matches the backend's own cache, so a shorter
 * one here would only add requests that return the same number.
 */
const STALE_MS = 60_000;

/** Quietly refresh while a picker or a plan page is open, so a price on screen does not go cold. */
const REFETCH_MS = 60_000;

/**
 * Addresses per request. The backend rejects a longer list outright (MAX_ADDRESSES in
 * tokens/token-price.controller.ts), so this is its limit, not a preference.
 */
const CHUNK_SIZE = 60;

/**
 * Ceiling on how many tokens are priced at once — five requests' worth.
 *
 * This used to be 60, applied by truncating the address list, and that was a bug with a very
 * convincing disguise: BNB Chain offers 104 tokens, the picker asked for the 60 whose *address*
 * sorted first, and the other 44 rendered as "No price feed" — a sentence about the market that was
 * really a sentence about a slice(). LINK (0xf8a0…) has a price on both feeds and never had one on
 * screen. A list longer than the backend takes is split across requests now; only a list longer than
 * any picker shows is still cut, and cutting there is a bug in the caller.
 */
const MAX_ADDRESSES = CHUNK_SIZE * 5;

export interface TokenPriceMap {
  /** USD price by lowercased address. Missing keys mean no feed quoted that token. */
  byAddress: Map<string, TokenPriceItem>;
  isLoading: boolean;
  /** Every request failed — prices could not be read at all, as opposed to read and found empty. */
  isUnavailable: boolean;
  /**
   * Addresses whose request failed, so nothing is known about them either way.
   *
   * Distinct from simply being absent from `byAddress`, which means the feeds answered and none of
   * them quotes that token. Splitting the list across requests makes partial failure possible — one
   * chunk can 500 while the rest succeed — and a caller that cannot tell the two apart would print
   * "no feed quotes this" over what is really a failed fetch.
   */
  unavailableAddresses: Set<string>;
}

/**
 * USD prices for a set of tokens on one chain, in as few requests as the backend's cap allows.
 *
 * Batched deliberately: the new-plan picker shows a price beside every token it lists, and one
 * request per row would rate-limit the feeds behind /api/token-price into answering nothing. The
 * address list is sorted into the query key so a re-render that reorders the list does not refetch,
 * and sorting before chunking is what keeps each chunk's key stable across renders.
 *
 * Chunks are separate queries rather than one query issuing several fetches, so a chunk that is
 * already cached is not refetched because a later one is cold, and a chunk that fails retries alone.
 */
export function useTokenPrices(
  chainId: number | undefined,
  addresses: readonly string[],
  /**
   * Off by default for nobody, but pass `false` while the UI asking for prices is not on screen. The
   * new-plan modal stays mounted with `open={false}`, and left ungated it would keep a whole token
   * list's prices refreshing every minute behind a closed dialog — on the backend that is one
   * outbound request per token per minute, for a list nobody is looking at.
   */
  options?: { enabled?: boolean },
): TokenPriceMap {
  const wanted = useMemo(() => {
    const seen = new Set<string>();
    for (const raw of addresses) {
      const address = raw?.toLowerCase();
      if (address && /^0x[0-9a-f]{40}$/.test(address)) seen.add(address);
    }
    return [...seen].sort().slice(0, MAX_ADDRESSES);
  }, [addresses]);

  const chunks = useMemo(() => {
    const out: string[][] = [];
    for (let i = 0; i < wanted.length; i += CHUNK_SIZE) out.push(wanted.slice(i, i + CHUNK_SIZE));
    return out;
  }, [wanted]);

  const enabled = chainId != null && options?.enabled !== false;

  // `combine` runs on the query results rather than in a render-time useMemo: useQueries hands back
  // a fresh array every render, so a plain memo over it would rebuild the map (and hand every
  // consumer a new Map identity) on renders where no price actually changed.
  return useQueries({
    queries: chunks.map((chunk) => {
      const key = chunk.join(",");
      return {
        queryKey: ["token-prices", chainId, key],
        enabled,
        queryFn: async (): Promise<TokenPriceResponse> => {
          const response = await fetch(`/api/token-price?chainId=${chainId}&addresses=${key}`, {
            headers: { accept: "application/json" },
          });
          if (!response.ok) throw new Error(`Token prices unavailable (${response.status})`);
          return (await response.json()) as TokenPriceResponse;
        },
        staleTime: STALE_MS,
        refetchInterval: REFETCH_MS,
        // A price is decoration on a form that works without it — one retry, then leave it blank.
        retry: 1,
      };
    }),
    combine: (results) => {
      const byAddress = new Map<string, TokenPriceItem>();
      const unavailableAddresses = new Set<string>();
      let failed = 0;

      results.forEach((result, index) => {
        if (result.isError || result.data?.source === "unavailable") {
          failed += 1;
          for (const address of chunks[index] ?? []) unavailableAddresses.add(address);
          return;
        }
        for (const price of result.data?.prices ?? []) {
          if (price.usd != null) byAddress.set(price.address.toLowerCase(), price);
        }
      });

      return {
        byAddress,
        isLoading: enabled && results.some((result) => result.isPending),
        // Only when nothing came back at all. One failed chunk out of three is a gap in the answer,
        // reported per address, not an outage of the whole feed.
        isUnavailable: results.length > 0 && failed === results.length,
        unavailableAddresses,
      };
    },
  });
}

/** One token's USD price. Thin wrapper over the batch so both paths share a cache entry shape. */
export function useTokenPrice(
  chainId: number | undefined,
  address: string | undefined,
  options?: { enabled?: boolean },
): { usd: number | null; isLoading: boolean; stale: boolean } {
  const addresses = useMemo(() => (address ? [address] : []), [address]);
  const { byAddress, isLoading } = useTokenPrices(chainId, addresses, options);
  const hit = address ? byAddress.get(address.toLowerCase()) : undefined;
  return { usd: hit?.usd ?? null, isLoading, stale: hit?.stale ?? false };
}

/**
 * A USD price formatted for a token of unknown scale. $64,213.55 and $0.00000418 are both prices a
 * DCA plan will really be quoted, so the number of decimals follows the magnitude rather than being
 * fixed at two — a memecoin rendered at 2dp reads as "$0.00", which is not a price.
 */
export function formatTokenPrice(usd: number | null | undefined): string | null {
  if (usd == null || !Number.isFinite(usd) || usd <= 0) return null;
  if (usd >= 1000) return `$${usd.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (usd >= 1) return `$${usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (usd >= 0.01) return `$${usd.toFixed(4)}`;
  if (usd >= 0.000001) return `$${usd.toFixed(8).replace(/0+$/, "")}`;
  // Below a millionth of a dollar, decimals stop being readable — 4.18e-9 is.
  return `$${usd.toExponential(2)}`;
}
