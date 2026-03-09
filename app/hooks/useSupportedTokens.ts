"use client";

import type { Address } from "viem";
import { useMemo } from "react";
import { getTokenList } from "@/config/contracts";

export type SupportedTokenOption = {
  symbol: string;
  name: string;
  address: Address;
  decimals: number;
  logo?: string;
};

/** Token list for swap/DCA: from config (trending-tokens.json + static lists). No runtime API. */
export function useSupportedTokens(chainId: number | undefined): {
  tokens: SupportedTokenOption[];
  isLoading: boolean;
  error: boolean;
} {
  const tokens = useMemo(() => {
    const list = chainId != null ? getTokenList(chainId) : [];
    return list.map((t) => ({
      symbol: t.symbol,
      name: t.name,
      address: t.address as Address,
      decimals: t.decimals,
      logo: t.logo,
    }));
  }, [chainId]);
  return { tokens, isLoading: false, error: false };
}
