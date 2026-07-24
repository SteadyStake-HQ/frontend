"use client";

import { useQuery } from "@tanstack/react-query";
import { useGasPrice } from "wagmi";
import { formatUnits } from "viem";
import { GAS_UNITS_PER_RUN } from "@/config/gas-cost-env";

/**
 * What one scheduled run costs, measured rather than tabulated.
 *
 * Gas is not one number: it is the chain's live gas price times the gas two transactions burn,
 * valued in the token that chain charges in. All three differ per network and two of them move
 * minute to minute, so a hardcoded "0.004 BOT per run" is wrong on every chain but one and goes
 * stale on that one too. This reads the gas price from each network and the token price from
 * /api/native-price, so the breakdown a user is shown is the breakdown as it stands right now.
 *
 * The tank is still charged the flat on-chain gasCostPerExecutionUsdc6 — this explains where that
 * figure comes from, and shows honestly when the network has drifted away from it.
 */

/**
 * Where a quoted price came from. Shown to the user: an operator-set price is not a market one.
 * "botdex" is BOT Chain's own DEX pool (mainnet BOT), "static" is a pinned testnet rate.
 */
export type PriceSource = "override" | "coingecko" | "botdex" | "static" | null;

/** USD price of a chain's native token; null while loading or where no feed quotes it. */
export function useNativePriceUsd(chainId: number | undefined): {
  usd: number | null;
  source: PriceSource;
  isLoading: boolean;
} {
  const enabled = Boolean(chainId && chainId > 0);
  const { data, isLoading } = useQuery({
    queryKey: ["native-price", chainId],
    enabled,
    // A gas estimate does not need a tick-by-tick quote, and the route caches for the same window.
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    retry: 1,
    queryFn: async () => {
      const res = await fetch(`/api/native-price?chainId=${chainId}`);
      if (!res.ok) return { usd: null, source: null as PriceSource };
      const json = (await res.json()) as { usd?: number | null; source?: PriceSource };
      return {
        usd: typeof json.usd === "number" && json.usd > 0 ? json.usd : null,
        source: json.source ?? null,
      };
    },
  });
  return { usd: data?.usd ?? null, source: data?.source ?? null, isLoading: enabled && isLoading };
}

export interface RunCostBreakdown {
  /** Live gas price on this chain, in wei. */
  gasPriceWei: bigint | null;
  /** Gas price in gwei, for display. */
  gasPriceGwei: number | null;
  /** Native token spent per run: gas price × the gas both transactions burn. */
  feeNative: number | null;
  /** USD price of the native token, where one is available. */
  nativeUsd: number | null;
  /** Which feed that price came from — a market quote and a configured one are not the same claim. */
  nativeSource: PriceSource;
  /** What a run costs the relayer right now, in USD. Null unless both inputs resolved. */
  liveUsd: number | null;
  isLoading: boolean;
}

export function useRunCostBreakdown(chainId: number | undefined): RunCostBreakdown {
  const enabled = Boolean(chainId && chainId > 0);
  const { data: gasPriceWei, isLoading: gasLoading } = useGasPrice({
    chainId,
    query: {
      enabled,
      staleTime: 30_000,
      // Gas prices move; a modal left open should not keep quoting the price at open time.
      refetchInterval: 60_000,
      retry: 1,
    },
  });
  const {
    usd: nativeUsd,
    source: nativeSource,
    isLoading: priceLoading,
  } = useNativePriceUsd(chainId);

  const feeNative =
    gasPriceWei != null ? Number(formatUnits(gasPriceWei * GAS_UNITS_PER_RUN, 18)) : null;
  const liveUsd = feeNative != null && nativeUsd != null ? feeNative * nativeUsd : null;

  return {
    gasPriceWei: gasPriceWei ?? null,
    gasPriceGwei: gasPriceWei != null ? Number(formatUnits(gasPriceWei, 9)) : null,
    feeNative,
    nativeUsd,
    nativeSource,
    liveUsd,
    isLoading: gasLoading || priceLoading,
  };
}

/** Small native amounts need significant digits, not decimal places: 0.0000412 ETH is real. */
export function formatNativeAmount(n: number): string {
  if (n === 0) return "0";
  if (n < 0.000001) return "<0.000001";
  return n.toLocaleString("en-US", { maximumSignificantDigits: 3 });
}

/** A token price: cents for normal tokens, significant digits for ones worth fractions of one. */
export function formatUsdPrice(n: number): string {
  return n >= 1
    ? `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$${n.toLocaleString("en-US", { maximumSignificantDigits: 3 })}`;
}
