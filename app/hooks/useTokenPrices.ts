"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { TokenPriceItem, TokenPriceResponse } from "@/app/api/token-price/route";

/**
 * How long a quote is served before it is refetched. Matches the backend's own cache, so a shorter
 * one here would only add requests that return the same number.
 */
const STALE_MS = 60_000;

/** Quietly refresh while a picker or a plan page is open, so a price on screen does not go cold. */
const REFETCH_MS = 60_000;

/** The backend prices this many addresses per request; longer lists are truncated, not split. */
const MAX_ADDRESSES = 60;

export interface TokenPriceMap {
  /** USD price by lowercased address. Missing keys mean no feed quoted that token. */
  byAddress: Map<string, TokenPriceItem>;
  isLoading: boolean;
  /** Prices could not be read at all, as opposed to read and found empty. */
  isUnavailable: boolean;
}

/**
 * USD prices for a set of tokens on one chain, in a single request.
 *
 * Batched deliberately: the new-plan picker shows a price beside every token it lists, and one
 * request per row would rate-limit the feeds behind /api/token-price into answering nothing. The
 * address list is sorted into the query key so a re-render that reorders the list does not refetch.
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

  const key = wanted.join(",");
  const enabled = chainId != null && wanted.length > 0 && options?.enabled !== false;

  const { data, isPending, isError } = useQuery<TokenPriceResponse>({
    queryKey: ["token-prices", chainId, key],
    enabled,
    queryFn: async () => {
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
  });

  const byAddress = useMemo(() => {
    const map = new Map<string, TokenPriceItem>();
    for (const price of data?.prices ?? []) {
      if (price.usd != null) map.set(price.address.toLowerCase(), price);
    }
    return map;
  }, [data]);

  return {
    byAddress,
    isLoading: enabled && isPending,
    isUnavailable: isError || data?.source === "unavailable",
  };
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
