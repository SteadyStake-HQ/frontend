"use client";

import { useCallback } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { useContracts } from "@/app/hooks/useContracts";
import { GAS_TANK_ABI, ERC20_ABI } from "@/config/abis";
import { getContracts } from "@/config/contracts";
import { SUPPORTED_CHAIN_IDS } from "@/config/chains-env";
import { parseUnits } from "viem";

const ZERO = "0x0000000000000000000000000000000000000000";

/** Chains that have GasTank deployed (non-zero address). */
export function getChainsWithGasTank(): number[] {
  return SUPPORTED_CHAIN_IDS.filter((cid) => {
    const c = getContracts(cid);
    return c?.GasTank && c.GasTank !== ZERO;
  });
}

import { getGasCostPerRunUsd } from "@/config/gas-cost-env";

/** Buffer multiplier for network instability (user must have runs × cost × BUFFER in gas tank). */
export const GAS_BUFFER_MULTIPLIER = 3;

export function useGasTank() {
  const { address } = useAccount();
  const { chainId, contracts } = useContracts();
  const queryClient = useQueryClient();
  const gasTankAddress = contracts.GasTank;
  const hasGasTank = gasTankAddress && gasTankAddress !== ZERO;

  const { data: balance, isLoading: balanceLoading, refetch: refetchBalance } = useReadContract({
    address: hasGasTank ? (gasTankAddress as `0x${string}`) : undefined,
    abi: GAS_TANK_ABI,
    functionName: "balanceOf",
    args: [address as `0x${string}`],
    chainId,
    query: { enabled: Boolean(address && hasGasTank), staleTime: 10_000 },
  });

  const { writeContract: writeDeposit, isPending: isDepositing } = useWriteContract();
  const { writeContract: writeWithdraw, isPending: isWithdrawing } = useWriteContract();

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: contracts.MockUSDC as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [address as `0x${string}`, gasTankAddress as `0x${string}`],
    chainId,
    query: { enabled: Boolean(address && hasGasTank) },
  });

  /** Call after approving USDC for GasTank. */
  const deposit = useCallback(
    async (amountUsdc: string) => {
      if (!address || !hasGasTank) throw new Error("Wallet not connected or GasTank not deployed");
      const amount = parseUnits(amountUsdc, 6);
      return new Promise<void>((resolve, reject) => {
        writeDeposit(
          {
            address: gasTankAddress as `0x${string}`,
            abi: GAS_TANK_ABI,
            functionName: "deposit",
            args: [amount],
            chainId,
          },
          {
            onSuccess: () => {
              refetchBalance();
              refetchAllowance();
              queryClient.invalidateQueries({ queryKey: ["dca-vault"] });
              resolve();
            },
            onError: reject,
          }
        );
      });
    },
    [address, hasGasTank, gasTankAddress, chainId, writeDeposit, refetchBalance, refetchAllowance, queryClient]
  );

  const withdraw = useCallback(
    async (amountUsdc: string) => {
      if (!address || !hasGasTank) throw new Error("Wallet not connected or GasTank not deployed");
      const amount = parseUnits(amountUsdc, 6);
      return new Promise<void>((resolve, reject) => {
        writeWithdraw(
          {
            address: gasTankAddress as `0x${string}`,
            abi: GAS_TANK_ABI,
            functionName: "withdraw",
            args: [amount],
            chainId,
          },
          {
            onSuccess: () => {
              refetchBalance();
              resolve();
            },
            onError: reject,
          }
        );
      });
    },
    [address, hasGasTank, gasTankAddress, chainId, writeWithdraw, refetchBalance]
  );

  return {
    balance: balance ?? 0n,
    balanceLoading,
    refetchBalance,
    deposit,
    withdraw,
    isDepositing,
    isWithdrawing,
    hasGasTank: !!hasGasTank,
    allowance: allowance ?? 0n,
    refetchAllowance,
  };
}

/** Gas cost per execution (USDC 6 decimals) from contract for a chain. Returns 0n if no GasTank or not set. */
export function useGasCostPerExecutionForChain(chainId: number): bigint {
  const contracts = getContracts(chainId);
  const gasTank = contracts?.GasTank;
  const hasGasTank = gasTank && gasTank !== ZERO;
  const { data } = useReadContract({
    address: hasGasTank ? (gasTank as `0x${string}`) : undefined,
    abi: GAS_TANK_ABI,
    functionName: "gasCostPerExecutionUsdc6",
    args: [],
    chainId,
    query: { enabled: !!hasGasTank, staleTime: 60_000 },
  });
  return data ?? 0n;
}

/** Required gas (USDC 6 decimals) for a plan: totalRuns × costPerRun (exact, no buffer). Use when contract gas cost is known. */
export function requiredGasUsdc6Exact(totalRuns: number, chainId: number): bigint {
  const costPerRun = getGasCostPerRunUsd(chainId);
  const usd = totalRuns * costPerRun;
  return BigInt(Math.ceil(usd * 1_000_000)); // 6 decimals
}

/** Required gas (USDC 6 decimals) for a plan: totalRuns × costPerRunUsd(chainId) × buffer. Fallback when contract cost is 0. */
export function requiredGasUsdc6(totalRuns: number, chainId: number): bigint {
  const costPerRun = getGasCostPerRunUsd(chainId);
  const usd = totalRuns * costPerRun * GAS_BUFFER_MULTIPLIER;
  return BigInt(Math.ceil(usd * 1_000_000)); // 6 decimals
}

/** Balance for one chain (for use in multi-chain aggregation). */
function useGasTankBalanceForChain(chainId: number): bigint {
  const { address } = useAccount();
  const contracts = getContracts(chainId);
  const gasTank = contracts?.GasTank;
  const hasGasTank = gasTank && gasTank !== ZERO;
  const { data } = useReadContract({
    address: hasGasTank ? (gasTank as `0x${string}`) : undefined,
    abi: GAS_TANK_ABI,
    functionName: "balanceOf",
    args: [address as `0x${string}`],
    chainId,
    query: { enabled: !!address && !!hasGasTank, staleTime: 15_000 },
  });
  return data ?? 0n;
}

/** Total gas tank balance across all networks (CEX-style: one balance, use on any chain). */
export function useGasTankAllChains(): {
  totalBalanceUsdc6: bigint;
  byChain: Record<number, bigint>;
  isLoading: boolean;
  refetch: () => void;
} {
  const b84532 = useGasTankBalanceForChain(84532);
  const b8453 = useGasTankBalanceForChain(8453);
  const b11155111 = useGasTankBalanceForChain(11155111);
  const b56 = useGasTankBalanceForChain(56);
  const b137 = useGasTankBalanceForChain(137);
  const b2222 = useGasTankBalanceForChain(2222);
  const byChain: Record<number, bigint> = {
    84532: b84532,
    8453: b8453,
    11155111: b11155111,
    56: b56,
    137: b137,
    2222: b2222,
  };
  const totalBalanceUsdc6 = b84532 + b8453 + b11155111 + b56 + b137 + b2222;
  return {
    totalBalanceUsdc6,
    byChain,
    isLoading: false,
    refetch: () => {},
  };
}
