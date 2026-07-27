"use client";

import { useCallback, useMemo } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { useContracts } from "@/app/hooks/useContracts";
import { GAS_TANK_ABI, ERC20_ABI } from "@/config/abis";
import { getContracts } from "@/config/contracts";
import { SUPPORTED_CHAIN_IDS } from "@/config/chains-env";
import { refreshGasTankBalances } from "@/lib/gas-tank-refresh";
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
import { useOperatorRunPriceUsdc6 } from "@/app/hooks/useRunCost";

/** A tank that can cover this many runs is drawn full. Nothing on-chain says so — it is a scale. */
export const RUNS_FOR_FULL_TANK = 100;

/** Below this many remaining runs the tank is called out as running low. */
export const LOW_TANK_RUNS = 10;

/**
 * Refresh every gas tank read on the page. Call after any deposit or withdraw — the balance is
 * shown in several places at once and they all have to agree, not just the one that moved it.
 */
export function useGasTankRefresh(): () => Promise<void> {
  const queryClient = useQueryClient();
  return useCallback(() => refreshGasTankBalances(queryClient), [queryClient]);
}

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
              void refreshGasTankBalances(queryClient);
              queryClient.invalidateQueries({ queryKey: ["dca-vault"] });
              resolve();
            },
            onError: reject,
          }
        );
      });
    },
    [address, hasGasTank, gasTankAddress, chainId, writeDeposit, queryClient]
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
              void refreshGasTankBalances(queryClient);
              resolve();
            },
            onError: reject,
          }
        );
      });
    },
    [address, hasGasTank, gasTankAddress, chainId, writeWithdraw, queryClient]
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

/** Where the per-run charge came from, in the order it is resolved. */
export type RunPriceSource = "operator" | "contract" | "config";

/**
 * What one run charges this network's tank, and who decided it.
 *
 * Three parties can set this and they are tried in the order the relayer tries them
 * (backend/src/run-executor.ts), because a number the UI quotes and the relayer does not debit is
 * worse than no number at all:
 *
 *   operator — a flat rate set per network on the backend dashboard. Editable without a
 *              transaction, which is why it outranks the contract.
 *   contract — the GasTank's own gasCostPerExecutionUsdc6, changed only by an owner tx.
 *   config   — the build-time per-chain default, for a chain where neither is set.
 *
 * Everything user-facing that prices a run goes through here, so the top-up modal, the plan
 * creator's prepay and the runs-left gauge can never quote three different prices.
 */
export function useEffectiveRunPriceUsdc6(chainId: number | undefined): {
  usdc6: bigint;
  source: RunPriceSource;
} {
  const { usdc6: operatorUsdc6 } = useOperatorRunPriceUsdc6(chainId);
  const contractUsdc6 = useGasCostPerExecutionForChain(chainId ?? 0);

  if (operatorUsdc6 != null && operatorUsdc6 > 0n) {
    return { usdc6: operatorUsdc6, source: "operator" };
  }
  if (contractUsdc6 > 0n) {
    return { usdc6: contractUsdc6, source: "contract" };
  }
  return {
    usdc6: BigInt(Math.max(1, Math.ceil(getGasCostPerRunUsd(chainId ?? 0) * 1_000_000))),
    source: "config",
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

/*
 * `requiredGasUsdc6` / `requiredGasUsdc6Exact` used to live here: totalRuns × the build-time
 * per-chain constant, one with a 3x buffer. They priced a plan off a number no operator could
 * change and the relayer never charged, so a plan prepaid through them could still run its tank
 * dry. Multiply useEffectiveRunPriceUsdc6 by the run count instead — that is the price the
 * relayer debits, whoever set it.
 */

type ChainBalance = { balance: bigint; isLoading: boolean };

/** Balance for one chain (for use in multi-chain aggregation). */
function useGasTankBalanceForChain(chainId: number): ChainBalance {
  const { address } = useAccount();
  const contracts = getContracts(chainId);
  const gasTank = contracts?.GasTank;
  const hasGasTank = gasTank && gasTank !== ZERO;
  const enabled = Boolean(address && hasGasTank);
  const { data, isLoading } = useReadContract({
    address: hasGasTank ? (gasTank as `0x${string}`) : undefined,
    abi: GAS_TANK_ABI,
    functionName: "balanceOf",
    args: [address as `0x${string}`],
    chainId,
    query: {
      enabled,
      staleTime: 15_000,
      // The relayer spends this balance in the background, so a page left open should not
      // keep quoting a number that has already been drawn down.
      refetchInterval: 30_000,
      refetchOnWindowFocus: true,
    },
  });
  return { balance: data ?? 0n, isLoading: enabled && isLoading };
}

/** Total gas tank balance across all networks (CEX-style: one balance, use on any chain). */
export function useGasTankAllChains(): {
  totalBalanceUsdc6: bigint;
  byChain: Record<number, bigint>;
  isLoading: boolean;
  refetch: () => Promise<void>;
} {
  const b84532 = useGasTankBalanceForChain(84532);
  const b8453 = useGasTankBalanceForChain(8453);
  const b11155111 = useGasTankBalanceForChain(11155111);
  const b56 = useGasTankBalanceForChain(56);
  const b137 = useGasTankBalanceForChain(137);
  const b2222 = useGasTankBalanceForChain(2222);
  const b677 = useGasTankBalanceForChain(677);
  const b968 = useGasTankBalanceForChain(968);
  const refetch = useGasTankRefresh();

  const byChain: Record<number, bigint> = useMemo(
    () => ({
      84532: b84532.balance,
      8453: b8453.balance,
      11155111: b11155111.balance,
      56: b56.balance,
      137: b137.balance,
      2222: b2222.balance,
      677: b677.balance,
      968: b968.balance,
    }),
    [
      b84532.balance,
      b8453.balance,
      b11155111.balance,
      b56.balance,
      b137.balance,
      b2222.balance,
      b677.balance,
      b968.balance,
    ]
  );

  const all = [b84532, b8453, b11155111, b56, b137, b2222, b677, b968];
  const totalBalanceUsdc6 = all.reduce((sum, c) => sum + c.balance, 0n);

  return {
    totalBalanceUsdc6,
    byChain,
    isLoading: all.some((c) => c.isLoading),
    refetch,
  };
}

/**
 * How many scheduled runs the tank can still pay for, and how full it looks.
 *
 * A raw USDC figure means nothing at cents scale — "0.0250 USDC" reads as empty until you know a
 * run costs 0.001. Runs are the unit users actually care about, and the level drives the gauges.
 */
export function useGasTankLevel(balanceUsdc6: bigint, chainId: number | undefined) {
  const { usdc6: costPerRunUsdc6, source: costSource } = useEffectiveRunPriceUsdc6(chainId);
  const runsLeft = costPerRunUsdc6 > 0n ? Number(balanceUsdc6 / costPerRunUsdc6) : 0;
  return {
    costPerRunUsdc6,
    /** Who set that price — an operator's flat rate is not the same claim as the contract's. */
    costSource,
    runsLeft,
    /** 0–1, full at RUNS_FOR_FULL_TANK runs — a gauge needs a ceiling and this is a plausible one. */
    level: Math.min(1, runsLeft / RUNS_FOR_FULL_TANK),
    isEmpty: balanceUsdc6 === 0n,
    isLow: balanceUsdc6 > 0n && runsLeft < LOW_TANK_RUNS,
  };
}
