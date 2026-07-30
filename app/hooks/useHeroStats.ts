"use client";

import { useMemo } from "react";
import { useReadContracts } from "wagmi";
import { ERC20_ABI } from "@/config/abis";
import {
  POOLED_DECIMALS,
  SUPPORTED_CHAIN_IDS,
  getContracts,
  toPooledUsd6,
} from "@/config/contracts";
import { getNetworkType } from "@/config/network-registry";
import type { config } from "@/config/wagmi";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/** wagmi types a call's `chainId` against the configured chains, not `number`. */
type WagmiChainId = (typeof config)["chains"][number]["id"];

/**
 * Below this the figure says nothing worth a headline slot — a vault holding a handful of test
 * dollars reads as a traction claim it cannot support — so the stat is hidden rather than shown
 * small. Hidden is the honest state, not a placeholder to fill.
 */
const MIN_DISPLAY_USD = 100;

/** Pooled 6-decimal total -> short dollar string. Empty below the display floor. */
function formatTvlUsd(total: number): string {
  if (total < MIN_DISPLAY_USD) return "";
  if (total >= 1_000_000_000) return `$${(total / 1_000_000_000).toFixed(1)}B`;
  if (total >= 1_000_000) return `$${(total / 1_000_000).toFixed(1)}M`;
  if (total >= 1_000) return `$${(total / 1_000).toFixed(1)}k`;
  return `$${Math.round(total)}`;
}

export interface HeroStats {
  activeUsers: number;
  totalValueUsd: number;
  /** Short dollar string, or "" when the total is under MIN_DISPLAY_USD and must not be shown. */
  totalValueFormatted: string;
  avgReturnPercent: number;
  successRatePercent: number;
}

/**
 * Live stats for the hero. Total Value is the settlement stablecoin held by the vaults on every
 * mainnet this build talks to — testnets are excluded, since faucet balances are not value.
 *
 * Balances are normalised through toPooledUsd6 before they are summed: they arrive in each chain's
 * own base units, and adding BNB Chain's 18-decimal raw balance straight into a 6-decimal total
 * inflates it by 10^12 (that is what turned a few thousand dollars into "$5250.0M").
 *
 * The other metrics stay 0 until we have an API/indexer behind them; Hero omits any stat it has no
 * number for.
 */
export function useHeroStats(): HeroStats {
  const vaults = useMemo(
    () =>
      SUPPORTED_CHAIN_IDS.filter((chainId) => getNetworkType(chainId) === "mainnet")
        .map((chainId) => {
          const c = getContracts(chainId);
          if (!c) return null;
          if (c.DCAVault === ZERO_ADDRESS || c.MockUSDC === ZERO_ADDRESS) return null;
          return {
            chainId: chainId as WagmiChainId,
            vault: c.DCAVault as `0x${string}`,
            stable: c.MockUSDC as `0x${string}`,
          };
        })
        .filter((v): v is NonNullable<typeof v> => v !== null),
    [],
  );

  const { data } = useReadContracts({
    contracts: vaults.map(
      ({ chainId, vault, stable }) =>
        ({
          address: stable,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [vault],
          chainId,
        }) as const,
    ),
    query: { enabled: vaults.length > 0 },
  });

  const totalUsd = useMemo(() => {
    if (!data) return 0;
    // One unreachable RPC must not zero the headline, so failed reads are skipped, not treated as 0.
    const pooled = data.reduce((sum, result, i) => {
      if (result.status !== "success" || typeof result.result !== "bigint") return sum;
      return sum + toPooledUsd6(result.result, vaults[i].chainId);
    }, 0n);
    return Number(pooled) / 10 ** POOLED_DECIMALS;
  }, [data, vaults]);

  return {
    activeUsers: 0,
    totalValueUsd: totalUsd,
    totalValueFormatted: formatTvlUsd(totalUsd),
    avgReturnPercent: 0,
    successRatePercent: 0,
  };
}
