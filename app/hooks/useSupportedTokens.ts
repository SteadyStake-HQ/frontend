"use client";

import type { Address } from "viem";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { TokenListResponse } from "@/app/api/tokens/route";

export type SupportedTokenOption = {
  symbol: string;
  name: string;
  address: Address;
  decimals: number;
  logo?: string;
};

/** A token list changes rarely; this is short enough that an operator's edit lands quickly. */
const STALE_MS = 60_000;

/** While the list is unavailable, keep asking — this is what refills the picker once it is back. */
const RETRY_WHILE_EMPTY_MS = 20_000;

/**
 * Token list for swap/DCA. **The backend is the only source.**
 *
 * The list is curated per network on the backend dashboard (/steadystake/tokens.html) and read here through
 * /api/tokens. There is deliberately no local fallback: the app used to keep a static list in
 * `config/trending-tokens.json` plus hand-maintained arrays in contracts.ts, and while that existed
 * the picker kept offering tokens no operator had approved — a removal on the dashboard did not
 * remove anything a user could see. A list with two sources is a list nobody controls.
 *
 * So when the backend cannot be read the picker is empty, and says so. That is the honest state: it
 * means nobody can currently vouch for what this network offers. A user can still paste a token
 * address by hand, which is checked on-chain, and existing plans are untouched.
 */
export function useSupportedTokens(chainId: number | undefined): {
  tokens: SupportedTokenOption[];
  isLoading: boolean;
  error: boolean;
  /**
   * The list could not be read at all — as opposed to being read and found empty. The picker shows
   * a different message for each: one is an outage, the other is a network nobody has set up yet.
   */
  isUnavailable: boolean;
} {
  const { data, isPending, isError } = useQuery<TokenListResponse>({
    queryKey: ["token-list", chainId],
    enabled: chainId != null,
    queryFn: async () => {
      const response = await fetch(`/api/tokens?chainId=${chainId}`, {
        headers: { accept: "application/json" },
      });
      if (!response.ok) throw new Error(`Token list unavailable (${response.status})`);
      return (await response.json()) as TokenListResponse;
    },
    staleTime: STALE_MS,
    // A rejection means the app's own route is unreachable, which a retry storm would not help.
    // One retry covers a blip; past that the poll below is what recovers.
    retry: 1,
    // With no fallback, an unreadable list means an empty picker — so it has to notice on its own
    // when the backend returns, rather than leaving a user staring at nothing until they reload.
    refetchInterval: (query) =>
      query.state.data?.source === "backend" ? false : RETRY_WHILE_EMPTY_MS,
  });

  const backendTokens = data?.source === "backend" ? data.tokens : null;

  const tokens = useMemo(() => {
    if (chainId == null || !backendTokens) return [];
    return backendTokens.map((token) => ({
      symbol: token.symbol,
      name: token.name,
      address: token.address as Address,
      decimals: token.decimals,
      logo: token.logoUrl ?? undefined,
    }));
  }, [chainId, backendTokens]);

  return {
    tokens,
    isLoading: chainId != null && isPending,
    error: isError,
    isUnavailable: !isPending && !backendTokens,
  };
}
