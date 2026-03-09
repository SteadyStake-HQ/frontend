"use client";

import { useReadContract } from "wagmi";
import { ERC20_ABI } from "@/config/abis";
import { getContracts } from "@/config/contracts";

const USDC_DECIMALS = 6;

/** Format USDC raw (6 decimals) to short dollar string: $1.2k, $2.1M, etc. */
function formatTvlUsd(rawTotal: bigint): string {
  const total = Number(rawTotal) / 10 ** USDC_DECIMALS;
  if (total >= 1_000_000) return `$${(total / 1_000_000).toFixed(1)}M`;
  if (total >= 1_000) return `$${(total / 1_000).toFixed(1)}k`;
  if (total >= 1) return `$${total.toFixed(2)}`;
  return "";
}

export interface HeroStats {
  activeUsers: number;
  totalValueUsd: number;
  totalValueFormatted: string;
  avgReturnPercent: number;
  successRatePercent: number;
}

/**
 * Live stats for the hero. Total Value comes from vault USDC balance on mainnets only.
 * Other metrics are 0 until we have an API/indexer (then we show them when > 0).
 */
export function useHeroStats(): HeroStats {
  const base = getContracts(8453);
  const bnb = getContracts(56);

  const { data: balanceBase } = useReadContract({
    address: base?.MockUSDC as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [base?.DCAVault as `0x${string}`],
    chainId: 8453,
  });

  const { data: balanceBnb } = useReadContract({
    address: bnb?.MockUSDC as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [bnb?.DCAVault as `0x${string}`],
    chainId: 56,
  });

  const rawBase = balanceBase ?? 0n;
  const rawBnb = balanceBnb ?? 0n;
  const rawTotal = rawBase + rawBnb;
  const totalUsd = Number(rawTotal) / 10 ** USDC_DECIMALS;

  return {
    activeUsers: 0,
    totalValueUsd: totalUsd,
    totalValueFormatted: formatTvlUsd(rawTotal),
    avgReturnPercent: 0,
    successRatePercent: 0,
  };
}
