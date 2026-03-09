"use client";

import { useCallback, useMemo } from "react";
import { useAccount, useWriteContract, useReadContract } from "wagmi";
import { useContracts } from "@/app/hooks/useContracts";
import { DCA_VAULT_ABI, ERC20_ABI } from "@/config/abis";
import { parseUnits } from "viem";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

export const useDCAVault = () => {
  const { address } = useAccount();
  const { chainId, contracts, isSupported } = useContracts();
  const { writeContract, isPending } = useWriteContract();

  const createSchedule = useCallback(
    async (
      targetToken: string,
      frequency: 0 | 1 | 2 | 3 | 4, // ONEMIN | DAILY | WEEKLY | BIWEEKLY | MONTHLY
      amountPerInterval: string, // in USDC (6 decimals)
      totalAmount: string, // in USDC (6 decimals)
      gasOverrides?: { maxFeePerGas?: bigint; maxPriorityFeePerGas?: bigint }
    ) => {
      if (!address) throw new Error("Wallet not connected");
      if (!isSupported) throw new Error("Unsupported network");

      return new Promise<`0x${string}`>((resolve, reject) => {
        writeContract(
          {
            address: contracts.DCAVault as `0x${string}`,
            abi: DCA_VAULT_ABI,
            functionName: "createSchedule",
            args: [
              targetToken as `0x${string}`,
              frequency,
              parseUnits(amountPerInterval, 6),
              parseUnits(totalAmount, 6),
            ],
            chainId,
            ...(gasOverrides?.maxFeePerGas != null && { maxFeePerGas: gasOverrides.maxFeePerGas }),
            ...(gasOverrides?.maxPriorityFeePerGas != null && {
              maxPriorityFeePerGas: gasOverrides.maxPriorityFeePerGas,
            }),
          },
          {
            onSuccess: (hash) => resolve(hash as `0x${string}`),
            onError: reject,
          },
        );
      });
    },
    [address, isSupported, writeContract, chainId, contracts],
  );

  /** Create schedule + enroll for auto-exec + fund gas tank in one tx. Use when enrolledCount === 0 and gasTank is set on vault. One approval (vault for totalAmount + gasAmountForTank). */
  const createScheduleAndEnrollWithGas = useCallback(
    async (
      targetToken: string,
      frequency: 0 | 1 | 2 | 3 | 4,
      amountPerInterval: string,
      totalAmount: string,
      gasAmountForTank: string, // USDC 6 decimals (can be "0")
      gasOverrides?: { maxFeePerGas?: bigint; maxPriorityFeePerGas?: bigint }
    ): Promise<`0x${string}`> => {
      if (!address) throw new Error("Wallet not connected");
      if (!isSupported) throw new Error("Unsupported network");

      return new Promise((resolve, reject) => {
        writeContract(
          {
            address: contracts.DCAVault as `0x${string}`,
            abi: DCA_VAULT_ABI,
            functionName: "createScheduleAndEnrollWithGas",
            args: [
              targetToken as `0x${string}`,
              frequency,
              parseUnits(amountPerInterval, 6),
              parseUnits(totalAmount, 6),
              parseUnits(gasAmountForTank, 6),
            ],
            chainId,
            ...(gasOverrides?.maxFeePerGas != null && { maxFeePerGas: gasOverrides.maxFeePerGas }),
            ...(gasOverrides?.maxPriorityFeePerGas != null && {
              maxPriorityFeePerGas: gasOverrides.maxPriorityFeePerGas,
            }),
          },
          {
            onSuccess: (hash) => resolve(hash as `0x${string}`),
            onError: reject,
          },
        );
      });
    },
    [address, isSupported, writeContract, chainId, contracts],
  );

  const cancelSchedule = useCallback(
    async (scheduleId: number) => {
      if (!address) throw new Error("Wallet not connected");
      if (!isSupported) throw new Error("Unsupported network");

      return new Promise((resolve, reject) => {
        writeContract(
          {
            address: contracts.DCAVault as `0x${string}`,
            abi: DCA_VAULT_ABI,
            functionName: "cancelSchedule",
            args: [BigInt(scheduleId)],
            chainId,
          },
          {
            onSuccess: resolve,
            onError: reject,
          },
        );
      });
    },
    [address, isSupported, writeContract, chainId, contracts],
  );

  const enrollForAutoExecution = useCallback(
    async (scheduleId: number | bigint): Promise<`0x${string}`> => {
      if (!address) throw new Error("Wallet not connected");
      if (!isSupported) throw new Error("Unsupported network");

      return new Promise((resolve, reject) => {
        writeContract(
          {
            address: contracts.DCAVault as `0x${string}`,
            abi: DCA_VAULT_ABI,
            functionName: "enrollForAutoExecution",
            args: [BigInt(scheduleId)],
            chainId,
          },
          {
            onSuccess: (hash) => resolve(hash as `0x${string}`),
            onError: reject,
          },
        );
      });
    },
    [address, isSupported, writeContract, chainId, contracts],
  );

  return {
    createSchedule,
    createScheduleAndEnrollWithGas,
    cancelSchedule,
    enrollForAutoExecution,
    isLoading: isPending,
  };
};

export const useDCAVaultRead = (userAddress?: string) => {
  const { address } = useAccount();
  const { chainId, contracts, isSupported } = useContracts();
  const user = userAddress || address;
  const userArg = (user ?? ZERO_ADDRESS) as `0x${string}`;

  // Get schedule count first
  const { data: scheduleCount, refetch: refetchCount } = useReadContract({
    address: contracts.DCAVault as `0x${string}`,
    abi: DCA_VAULT_ABI,
    functionName: "scheduleCount",
    args: [userArg],
    chainId,
    query: {
      enabled: !!user && isSupported,
      staleTime: 5_000,
      refetchInterval: 60_000,
      refetchOnMount: "always",
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  });

  // Get all active schedules
  const { data: activeSchedules, isLoading: schedulesLoading, refetch: refetchSchedules } =
    useReadContract({
      address: contracts.DCAVault as `0x${string}`,
      abi: DCA_VAULT_ABI,
      functionName: "getActiveSchedules",
      args: [userArg],
      chainId,
      query: {
        enabled: !!user && isSupported,
        staleTime: 5_000,
        refetchInterval: 60_000,
        refetchOnMount: "always",
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
    });

  const { data: enrolledCount } = useReadContract({
    address: contracts.DCAVault as `0x${string}`,
    abi: DCA_VAULT_ABI,
    functionName: "enrolledCount",
    args: [userArg],
    chainId,
    query: {
      enabled: !!user && isSupported,
      staleTime: 5_000,
      refetchInterval: 60_000,
      refetchOnMount: "always",
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  });

  // Generate all schedule IDs from 0 to scheduleCount-1
  const allScheduleIds = useMemo(
    () => (scheduleCount ? Array.from({ length: Number(scheduleCount) }, (_, i) => BigInt(i)) : []),
    [scheduleCount],
  );

  // Stable empty array when loading so consumers' useEffect deps don't change every render
  const activeSchedulesStable = useMemo(() => activeSchedules ?? [], [activeSchedules]);

  return {
    activeSchedules: activeSchedulesStable,
    allScheduleIds,
    scheduleCount: Number(scheduleCount || 0),
    enrolledCount: Number(enrolledCount ?? 0),
    isLoading: schedulesLoading,
    refetchSchedules,
    refetchCount,
  };
};

export const useDCASchedule = (scheduleId: bigint, userAddress?: string) => {
  const { address } = useAccount();
  const { chainId, contracts, isSupported } = useContracts();
  const user = userAddress || address;
  const userArg = (user ?? ZERO_ADDRESS) as `0x${string}`;
  const scheduleArg = scheduleId ?? BigInt(0);

  const { data: schedule, isLoading, refetch } = useReadContract({
    address: contracts.DCAVault as `0x${string}`,
    abi: DCA_VAULT_ABI,
    functionName: "getSchedule",
    args: [userArg, scheduleArg],
    chainId,
    query: {
      enabled: !!user && isSupported && scheduleId !== undefined,
      staleTime: 5_000,
      refetchInterval: 60_000,
      refetchOnMount: "always",
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  });

  const { data: isReady } = useReadContract({
    address: contracts.DCAVault as `0x${string}`,
    abi: DCA_VAULT_ABI,
    functionName: "isScheduleReady",
    args: [userArg, scheduleArg],
    chainId,
    query: {
      enabled: !!user && isSupported && scheduleId !== undefined,
      staleTime: 5_000,
      refetchInterval: 60_000,
      refetchOnMount: "always",
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  });

  const { data: enrolledForAutoExecution } = useReadContract({
    address: contracts.DCAVault as `0x${string}`,
    abi: DCA_VAULT_ABI,
    functionName: "enrolledForAutoExecution",
    args: [userArg, scheduleArg],
    chainId,
    query: {
      enabled: !!user && isSupported && scheduleId !== undefined,
      staleTime: 5_000,
      refetchInterval: 60_000,
      refetchOnMount: "always",
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  });

  return {
    schedule,
    isReady: isReady || false,
    isEnrolledForAutoExecution: enrolledForAutoExecution ?? false,
    isLoading,
    refetch, // Expose refetch for manual updates
  };
};

export const useTokenApproval = (tokenAddress: string) => {
  const { address } = useAccount();
  const { chainId, isSupported } = useContracts();
  const { writeContract, isPending } = useWriteContract();

  const approve = useCallback(
    async (amount: string, spender: string): Promise<`0x${string}` | void> => {
      if (!address) throw new Error("Wallet not connected");
      if (!isSupported) throw new Error("Unsupported network");

      return new Promise((resolve, reject) => {
        writeContract(
          {
            address: tokenAddress as `0x${string}`,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [spender as `0x${string}`, parseUnits(amount, 6)],
            chainId,
          },
          {
            onSuccess: (hash) => resolve(hash as `0x${string}`),
            onError: reject,
          },
        );
      });
    },
    [address, isSupported, tokenAddress, writeContract, chainId],
  );

  return { approve, isLoading: isPending };
};

export const useTokenBalance = (tokenAddress: string, userAddress?: string) => {
  const { address } = useAccount();
  const { chainId, isSupported } = useContracts();
  const user = userAddress || address;
  const userArg = (user ?? ZERO_ADDRESS) as `0x${string}`;

  const {
    data: balance,
    isLoading,
    refetch,
  } = useReadContract({
    address: tokenAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [userArg],
    chainId,
    query: {
      enabled: !!user && isSupported,
      staleTime: 3000,
      refetchInterval: 10000,
    },
  });

  return {
    balance: balance || BigInt(0),
    isLoading,
    refetch,
  };
};

export const useTokenAllowance = (
  tokenAddress: string,
  spender: string,
  userAddress?: string,
) => {
  const { address } = useAccount();
  const { chainId, isSupported } = useContracts();
  const user = userAddress || address;
  const userArg = (user ?? ZERO_ADDRESS) as `0x${string}`;

  const { data: allowance, isLoading, refetch: refetchAllowance } = useReadContract({
    address: tokenAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [userArg, spender as `0x${string}`],
    chainId,
    query: { enabled: !!user && isSupported },
  });

  return {
    allowance: allowance || BigInt(0),
    isLoading,
    refetchAllowance,
  };
};
