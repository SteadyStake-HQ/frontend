"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { useAccount, useBalance, useReadContract, useReadContracts, useWaitForTransactionReceipt } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { useDCAVault, useDCAVaultRead, useTokenApproval, useTokenAllowance, useContracts, useGasTank, useGasTankAllChains, useGasCostPerExecutionForChain, requiredGasUsdc6Exact } from "@/app/hooks";
import { getGasCostPerRunUsd } from "@/config/gas-cost-env";
import { CHAIN_NAMES } from "@/lib/constants";
import { useSupportedTokens } from "@/app/hooks/useSupportedTokens";
import { DCA_VAULT_ABI, ERC20_ABI } from "@/config/abis";
import { decodeEventLog } from "viem";
import { FREQUENCY_MAP } from "@/lib/constants";
import { FREQUENCY_OPTIONS, type FrequencyOptionId } from "@/config/frequencies-env";
import { getTokenLogoUrl } from "@/lib/token-logo";
import { formatUnits, getAddress, isAddress, parseUnits } from "viem";
import { getBumpedGasOptions } from "@/lib/get-bumped-gas";

const CUSTOM_TOKENS_STORAGE_KEY = "steadystake-custom-tokens";

function loadPersistedCustomTokens(): Record<number, TokenOption[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(CUSTOM_TOKENS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, Array<{ symbol?: string; name?: string; address?: string; decimals?: number; logo?: string }>>;
    const result: Record<number, TokenOption[]> = {};
    for (const [key, list] of Object.entries(parsed)) {
      const chainId = parseInt(key, 10);
      if (isNaN(chainId) || !Array.isArray(list)) continue;
      result[chainId] = list
        .filter((t) => t?.address && typeof t.symbol === "string" && typeof t.name === "string")
        .map((t) => ({
          symbol: t.symbol!,
          name: t.name!,
          address: t.address! as `0x${string}`,
          decimals: typeof t.decimals === "number" ? t.decimals : undefined,
          logo: typeof t.logo === "string" && t.logo.startsWith("http") ? t.logo : undefined,
          isCustom: true as const,
        }));
    }
    return result;
  } catch {
    return {};
  }
}

function saveCustomTokensToStorage(data: Record<number, TokenOption[]>) {
  try {
    const toStore: Record<string, Array<{ symbol: string; name: string; address: string; decimals?: number; logo?: string }>> = {};
    for (const [chainId, list] of Object.entries(data)) {
      toStore[String(chainId)] = list.map(({ symbol, name, address, decimals, logo }) => ({
        symbol,
        name,
        address,
        ...(decimals != null && { decimals }),
        ...(typeof logo === "string" && logo.startsWith("http") && { logo }),
      }));
    }
    window.localStorage.setItem(CUSTOM_TOKENS_STORAGE_KEY, JSON.stringify(toStore));
  } catch {
    // ignore
  }
}

type TokenOption = {
  symbol: string;
  name: string;
  address: `0x${string}`;
  decimals?: number;
  logo?: string;
  isCustom?: boolean;
};

/** Token logo: image when present, otherwise 2-letter placeholder from name (then symbol) capitalized. */
function TokenLogo({ logo, symbol, name, className }: { logo?: string; symbol: string; name?: string; className?: string }) {
  const [imgFailed, setImgFailed] = useState(false);
  useEffect(() => {
    queueMicrotask(() => setImgFailed(false));
  }, [logo]);
  const sizeClass = className ?? "h-6 w-6";
  const showImg = logo && !imgFailed;
  const fallbackLabel = (name || symbol || "").trim();
  const placeholder = fallbackLabel.length >= 2 ? fallbackLabel.slice(0, 2).toUpperCase() : fallbackLabel ? fallbackLabel.toUpperCase() : "?";
  return (
    <span className={`relative inline-flex ${sizeClass} shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--hero-muted)]/20 bg-[var(--hero-muted)]/5`}>
      {showImg ? (
        <img
          src={logo}
          alt=""
          className="h-full w-full object-cover"
          width={24}
          height={24}
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-[10px] font-medium text-[var(--hero-muted)]" aria-hidden>
          {placeholder}
        </span>
      )}
    </span>
  );
}

function TokenDropdown({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: TokenOption[];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  /** Match by address so selected logo always matches the option user picked (same symbol can appear twice). */
  const selected = options.find((t) => t.address.toLowerCase() === value?.toLowerCase()) ?? options[0];

  const filtered =
    search.trim() === ""
      ? options
      : options.filter((t) => {
          const q = search.trim().toLowerCase();
          return (
            t.name.toLowerCase().includes(q) ||
            t.symbol.toLowerCase().includes(q) ||
            t.address.toLowerCase().includes(q)
          );
        });

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl border border-[var(--hero-muted)]/15 bg-[var(--foreground)]/[0.04] px-3 py-2.5 text-left text-sm text-[var(--foreground)] transition-colors focus:border-[var(--hero-primary)]/40 focus:outline-none focus:ring-1 focus:ring-[var(--hero-primary)]/20"
      >
        <span className="flex min-w-0 flex-1 items-center gap-3">
          <TokenLogo logo={selected?.logo} symbol={selected?.symbol ?? "?"} name={selected?.name} />
          <span className="truncate font-medium">
            {selected?.name} ({selected?.symbol})
            {selected?.isCustom && (
              <span className="ml-1.5 inline-flex items-center rounded bg-[var(--hero-primary)]/20 px-1.5 py-0.5 text-[10px] font-medium text-[var(--hero-primary)]">
                Custom
              </span>
            )}
          </span>
        </span>
        <svg
          className={`h-5 w-5 shrink-0 text-[var(--hero-muted)] transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div
          className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-[var(--hero-muted)]/15 bg-[var(--background)] shadow-lg"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-b border-[var(--hero-muted)]/15 p-2">
            <input
              type="text"
              placeholder="Search by name or symbol..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") e.preventDefault();
              }}
              autoFocus
              className="w-full rounded-lg border border-[var(--hero-muted)]/20 bg-[color-mix(in_srgb,var(--foreground)_0.04)] px-3 py-2 text-sm placeholder:text-[var(--hero-muted)] focus:border-[var(--hero-primary)] focus:outline-none"
            />
          </div>
          <ul className="max-h-44 overflow-auto py-1" role="listbox">
            {filtered.length === 0 ? (
              <li className="px-4 py-3 text-sm text-[var(--hero-muted)]">No tokens match</li>
            ) : (
              filtered.map((t) => (
                <li key={`${t.symbol}-${t.address}`} role="option" aria-selected={value?.toLowerCase() === t.address.toLowerCase()}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(t.address);
                      setOpen(false);
                      setSearch("");
                    }}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-[var(--hero-muted)]/10 ${
                      value === t.symbol
                        ? "bg-[var(--hero-primary)]/15 text-[var(--hero-primary)]"
                        : "text-[var(--foreground)]"
                    }`}
                  >
                    <TokenLogo logo={t.logo} symbol={t.symbol} name={t.name} className="h-6 w-6" />
                    <span className="min-w-0 flex-1 truncate">
                      {t.name} ({t.symbol})
                    </span>
                    {t.isCustom && (
                      <span className="shrink-0 rounded bg-[var(--hero-primary)]/20 px-1.5 py-0.5 text-[10px] font-medium text-[var(--hero-primary)]">
                        Custom
                      </span>
                    )}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

interface NewDcaModalProps {
  open: boolean;
  onClose: () => void;
}

export function NewDcaModal({ open, onClose }: NewDcaModalProps) {
  const { address, isConnected } = useAccount();
  const { chainId, contracts } = useContracts();
  const queryClient = useQueryClient();
  const { tokens: tokensList, isLoading: isLoadingTokens } = useSupportedTokens(chainId);
  const [token, setToken] = useState<string>("");
  const [amountPerInterval, setAmountPerInterval] = useState("");
  const [runCount, setRunCount] = useState("");
  const [frequency, setFrequency] = useState<FrequencyOptionId>(FREQUENCY_OPTIONS[0]?.id ?? 1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [customTokensByChain, setCustomTokensByChain] = useState<Record<number, TokenOption[]>>(loadPersistedCustomTokens);
  const [customTokenInput, setCustomTokenInput] = useState("");
  const [addingAddress, setAddingAddress] = useState<`0x${string}` | null>(null);
  const [addTokenError, setAddTokenError] = useState<string | null>(null);
  const [manageCustomTokensOpen, setManageCustomTokensOpen] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const [pendingToken, setPendingToken] = useState<{
    address: `0x${string}`;
    name: string;
    symbol: string;
    decimals: number;
  } | null>(null);

  /** Tx hash of createSchedule once submitted; we wait for confirmation before refreshing dashboard */
  const [pendingCreateTxHash, setPendingCreateTxHash] = useState<`0x${string}` | undefined>(undefined);
  const { data: createReceipt } = useWaitForTransactionReceipt({ hash: pendingCreateTxHash });

  /** Enable auto-execution (one free per network; additional plans require fee). Captured at submit for post-confirm enroll. */
  const [enableAutoExec, setEnableAutoExec] = useState(true);
  const enableAutoExecForCreateRef = useRef(true);
  /** When true, we used createScheduleAndEnrollWithGas so no post-create deposit/enroll. */
  const useBatchedCreateRef = useRef(false);
  /** Gas amount to deposit to gas tank after create (when auto-exec); set at submit. */
  const requiredGasForPlanRef = useRef<bigint>(0n);

  const { data: customTokenMeta, isLoading: isLoadingCustomToken, isError: isCustomTokenError } = useReadContracts({
    contracts: addingAddress
      ? [
          { address: addingAddress, abi: ERC20_ABI, functionName: "symbol" },
          { address: addingAddress, abi: ERC20_ABI, functionName: "name" },
          { address: addingAddress, abi: ERC20_ABI, functionName: "decimals" },
        ]
      : [],
  });

  useEffect(() => {
    if (!addingAddress || !chainId || !customTokenMeta?.length || customTokenMeta.length < 3) return;
    const [symbolResult, nameResult, decimalsResult] = customTokenMeta;
    const symbol = symbolResult?.status === "success" ? String(symbolResult.result) : null;
    const name = nameResult?.status === "success" ? String(nameResult.result) : null;
    const decimals =
      decimalsResult?.status === "success" && typeof decimalsResult.result === "number"
        ? decimalsResult.result
        : 18;
    if (symbol != null && name != null) {
      setPendingToken({ address: addingAddress, name, symbol, decimals });
      setAddingAddress(null);
    }
  }, [addingAddress, chainId, customTokenMeta]);

  useEffect(() => {
    if (addingAddress && isCustomTokenError) {
      setAddTokenError("Invalid token contract or not supported on this network.");
      setAddingAddress(null);
    }
  }, [addingAddress, isCustomTokenError]);

  useEffect(() => {
    saveCustomTokensToStorage(customTokensByChain);
  }, [customTokensByChain]);

  const [isFetchingLogo, setIsFetchingLogo] = useState(false);
  const handleConfirmAddToken = async () => {
    if (!pendingToken || !chainId) return;
    setIsFetchingLogo(true);
    let logoUrl: string | undefined;
    try {
      const res = await fetch(
        `/api/token-logo-url?chainId=${encodeURIComponent(chainId)}&address=${encodeURIComponent(pendingToken.address)}`
      );
      if (res.ok) {
        const data = (await res.json()) as { logoUrl?: string | null };
        if (typeof data.logoUrl === "string" && data.logoUrl.startsWith("http")) {
          logoUrl = data.logoUrl;
        }
      }
    } catch {
      // keep logo undefined
    } finally {
      setIsFetchingLogo(false);
    }
    const newToken: TokenOption = {
      address: pendingToken.address,
      symbol: pendingToken.symbol,
      name: pendingToken.name,
      decimals: pendingToken.decimals,
      logo: logoUrl,
      isCustom: true,
    };
    setCustomTokensByChain((prev) => {
      const list = prev[chainId] ?? [];
      const exists = list.some((t) => t.address.toLowerCase() === pendingToken.address.toLowerCase());
      if (exists) return prev;
      return { ...prev, [chainId]: [...list, newToken] };
    });
    setCustomTokenInput("");
    setAddTokenError(null);
    setToken(pendingToken.address);
    setPendingToken(null);
  };

  const handleCancelAddToken = () => {
    setPendingToken(null);
  };


  const handleRemoveCustomToken = (address: string) => {
    if (!chainId) return;
    const addrLower = address.toLowerCase();
    const wasSelected = token?.toLowerCase() === addrLower;
    setCustomTokensByChain((prev) => {
      const list = prev[chainId] ?? [];
      const next = list.filter((t) => t.address.toLowerCase() !== addrLower);
      if (next.length === list.length) return prev;
      return { ...prev, [chainId]: next };
    });
    if (wasSelected) setToken("");
  };

  const TOKEN_LIST_LIMIT = 100;
  const customTokens = (chainId != null ? customTokensByChain[chainId] ?? [] : []) as TokenOption[];
  const customMapped = customTokens.map((t) => ({
    ...t,
    logo: getTokenLogoUrl(chainId ?? 0, t.address, t.logo) ?? t.logo,
    isCustom: true as const,
  }));
  const customAddresses = new Set(customTokens.map((t) => t.address.toLowerCase()));
  const listMapped = tokensList
    .filter((t) => !customAddresses.has(t.address.toLowerCase()))
    .map((t) => ({
      ...t,
      address: t.address as `0x${string}`,
      decimals: t.decimals,
      logo: getTokenLogoUrl(chainId ?? 0, t.address, t.logo) ?? t.logo,
      isCustom: false as const,
    }));
  const allTokenOptions: TokenOption[] = [...customMapped, ...listMapped].slice(0, TOKEN_LIST_LIMIT);

  const selectedOption = allTokenOptions.find((t) => t.address.toLowerCase() === token?.toLowerCase());
  const selectedTokenAddress = selectedOption?.address;

  const optionAddressesKey = allTokenOptions.map((t) => t.address).sort().join(",");
  useEffect(() => {
    if (allTokenOptions.length === 0) return;
    const currentInList = token && allTokenOptions.some((t) => t.address.toLowerCase() === token.toLowerCase());
    if (!currentInList) {
      setToken(allTokenOptions[0]?.address ?? "");
    }
  }, [chainId, optionAddressesKey, token]);

  // Hooks for contract interaction
  const { data: usdcBalance } = useBalance({
    address: address ?? undefined,
    token: contracts.MockUSDC as `0x${string}`,
    chainId,
  });

  const { createSchedule, createScheduleAndEnrollWithGas, enrollForAutoExecution, isLoading: isCreating } =
    useDCAVault();
  const { approve, isLoading: isApproving } = useTokenApproval(contracts.MockUSDC);
  const { enrolledCount, refetchCount } = useDCAVaultRead(address);
  const { data: additionalAutoPlanFeeUsdc6 } = useReadContract({
    address: contracts.DCAVault as `0x${string}`,
    abi: DCA_VAULT_ABI,
    functionName: "additionalAutoPlanFeeUsdc6",
    args: [],
    chainId,
  });
  const { data: vaultGasTankAddress } = useReadContract({
    address: contracts.DCAVault as `0x${string}`,
    abi: DCA_VAULT_ABI,
    functionName: "gasTank",
    args: [],
    chainId,
  });
  const { allowance, isLoading: isLoadingAllowance } = useTokenAllowance(
    contracts.MockUSDC,
    contracts.DCAVault,
    address
  );
  const { hasGasTank, deposit: depositToGasTank } = useGasTank();
  const { totalBalanceUsdc6: gasTankBalance } = useGasTankAllChains(); // Global balance (any network), CEX-style
  const { allowance: allowanceGasTank } = useTokenAllowance(
    contracts.MockUSDC,
    (hasGasTank && contracts.GasTank ? contracts.GasTank : "0x0000000000000000000000000000000000000000") as string,
    address
  );

  const usdcDecimals = usdcBalance?.decimals ?? 6;
  const balance = usdcBalance?.value ?? BigInt(0);
  const balanceFormatted = Number(formatUnits(balance, usdcDecimals));

  const runCountNum = runCount.trim() === "" ? 0 : Math.max(0, Math.floor(parseFloat(runCount) || 0));
  const totalRuns = runCountNum;
  const planTotalUsdc6 =
    amountPerInterval && runCountNum >= 1
      ? parseUnits((parseFloat(amountPerInterval) * runCountNum).toFixed(6), 6)
      : 0n;
  const gasCostPerExecutionUsdc6 = useGasCostPerExecutionForChain(chainId ?? 0);
  const requiredGasForPlan =
    totalRuns > 0 && chainId
      ? gasCostPerExecutionUsdc6 > 0n
        ? gasCostPerExecutionUsdc6 * BigInt(totalRuns)
        : requiredGasUsdc6Exact(totalRuns, chainId)
      : 0n;
  /** When auto-exec is on, gas is taken from USDC at create time and sent to gas tank; no separate top-up needed. */
  const gasAddedAtCreate = enableAutoExec && hasGasTank && requiredGasForPlan > 0n;
  const totalUsdcNeededForCreate = gasAddedAtCreate ? planTotalUsdc6 + requiredGasForPlan : planTotalUsdc6;
  const hasEnoughBalanceForCreate = balance >= totalUsdcNeededForCreate;
  const ZERO_ADDR = "0x0000000000000000000000000000000000000000";
  /** Batched path: one approval (vault for plan+gas) + one tx. No post-create deposit/enroll. Requires vault.gasTank set when gas > 0. */
  const useBatchedCreate = Boolean(
    enableAutoExec &&
    enrolledCount === 0 &&
    hasGasTank &&
    (requiredGasForPlan === 0n ||
      (vaultGasTankAddress &&
        String(vaultGasTankAddress).toLowerCase() !== ZERO_ADDR.toLowerCase()))
  );
  const gasTankBalanceFormatted = Number(formatUnits(gasTankBalance, 6));
  const requiredGasFormatted = requiredGasForPlan > 0n ? Number(formatUnits(requiredGasForPlan, 6)) : 0;
  const costPerRunUsd =
    gasCostPerExecutionUsdc6 > 0n
      ? Number(formatUnits(gasCostPerExecutionUsdc6, 6))
      : chainId
        ? getGasCostPerRunUsd(chainId)
        : 0.01;

  // Standard membership: one free auto-exec plan per network. Once they have one, new plans cannot use auto-exec.
  useEffect(() => {
    if (open && enrolledCount >= 1) setEnableAutoExec(false);
  }, [open, enrolledCount]);

  useEffect(() => {
    if (!open) return;
    const onEscape = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onEscape);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  // When modal closes, clear pending create hash and batched ref so we don't run refresh logic on reopen
  useEffect(() => {
    if (!open) {
      setPendingCreateTxHash(undefined);
      useBatchedCreateRef.current = false;
    }
  }, [open]);

  // After createSchedule tx is confirmed on-chain, enroll for auto-execution if requested, then reload dashboard and close
  useEffect(() => {
    if (!pendingCreateTxHash || createReceipt?.status !== "success") return;

    const run = async () => {
      let scheduleId: bigint | null = null;
      for (const log of createReceipt.logs) {
        try {
          const d = decodeEventLog({
            abi: DCA_VAULT_ABI,
            data: log.data,
            topics: log.topics,
          });
          if (d.eventName === "ScheduleCreated") {
            scheduleId = d.args.scheduleId as bigint;
            break;
          }
        } catch {
          // not our event
        }
      }

      if (enableAutoExecForCreateRef.current && scheduleId != null && address && contracts.DCAVault && !useBatchedCreateRef.current) {
        try {
          if (requiredGasForPlanRef.current > 0n) {
            await depositToGasTank(formatUnits(requiredGasForPlanRef.current, 6));
          }
          const count = enrolledCount;
          if (count === 0) {
            await enrollForAutoExecution(scheduleId);
          } else {
            const fee = additionalAutoPlanFeeUsdc6 ?? 0n;
            if (fee > 0n) {
              const feeStr = formatUnits(fee, 6);
              await approve(feeStr, contracts.DCAVault);
            }
            await enrollForAutoExecution(scheduleId);
          }
          setSuccessMessage(
            requiredGasForPlanRef.current > 0n
              ? "Schedule created and enrolled for auto-execution."
              : "Schedule created and enrolled for auto-execution."
          );
        } catch (e) {
          console.error("Enroll for auto-execution failed:", e);
          setSuccessMessage("Schedule created. Enroll for auto-execution failed — you can execute manually.");
        }
        await refetchCount?.();
      }

      const { invalidateDcaDashboardQueries } = await import("@/lib/invalidate-dca-queries");
      await invalidateDcaDashboardQueries(queryClient);
      const { dispatchDashboardRefresh } = await import("@/lib/dashboard-refresh-event");
      dispatchDashboardRefresh();
      if (useBatchedCreateRef.current) {
        setSuccessMessage("Schedule created and enrolled for auto-execution.");
        await refetchCount?.();
      }
      if (!enableAutoExecForCreateRef.current || scheduleId == null) {
        setSuccessMessage("Schedule created! Updating dashboard...");
      }
      setPendingCreateTxHash(undefined);
      setTimeout(() => {
        onClose();
        setSuccessMessage(null);
      }, 1500);
    };
    void run();
  }, [pendingCreateTxHash, createReceipt, queryClient, onClose, enrolledCount, additionalAutoPlanFeeUsdc6, enrollForAutoExecution, approve, address, contracts.DCAVault, refetchCount, depositToGasTank]);

  // If tx reverted, show error and stop pending state
  useEffect(() => {
    if (pendingCreateTxHash && createReceipt?.status === "reverted") {
      setError("Transaction reverted. Please try again.");
      setPendingCreateTxHash(undefined);
      setIsSubmitting(false);
    }
  }, [pendingCreateTxHash, createReceipt?.status]);

  // Surface important messages as toasts
  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  useEffect(() => {
    if (successMessage) {
      toast.success(successMessage);
    }
  }, [successMessage]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (contentRef.current && !contentRef.current.contains(e.target as Node))
      onClose();
  };

  const handleAddCustomToken = () => {
    setAddTokenError(null);
    const raw = customTokenInput.trim();
    if (!raw) return;
    if (!isAddress(raw)) {
      setAddTokenError("Please enter a valid contract address.");
      return;
    }
    setAddingAddress(getAddress(raw));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!isConnected || !address) {
      setError("Please connect your wallet");
      return;
    }

    if (!amountPerInterval || !runCount || runCountNum < 1) {
      setError("Please fill in per-run amount and run count");
      return;
    }

    const totalAmount = (parseFloat(amountPerInterval) * runCountNum).toFixed(6);
    const totalAmountBig = parseUnits(totalAmount, 6);
    const amountPerIntervalBig = parseUnits(amountPerInterval, 6);
    const gasNeededAtCreate = enableAutoExec && hasGasTank && requiredGasForPlan > 0n ? requiredGasForPlan : 0n;
    const totalNeeded = totalAmountBig + gasNeededAtCreate;

    // Check balance (plan + gas when auto-exec adds gas at create)
    if (balance < totalNeeded) {
      setError(
        gasNeededAtCreate > 0n
          ? `Insufficient USDC. You have ${balanceFormatted.toFixed(2)}. Need ${(Number(totalAmount) + requiredGasFormatted).toFixed(2)}.`
          : `Insufficient USDC balance. You have ${balanceFormatted.toFixed(2)}, need ${parseFloat(totalAmount).toFixed(2)}`
      );
      return;
    }

    // Approve DCAVault: one approval for plan (or plan+gas when batched)
    const approvalAmount = useBatchedCreate ? (totalAmountBig + gasNeededAtCreate) : totalAmountBig;
    if (allowance < approvalAmount) {
      setIsSubmitting(true);
      try {
        await approve(formatUnits(approvalAmount, 6), contracts.DCAVault);
        setSuccessMessage(useBatchedCreate ? "Approval successful. Creating plan with auto-execution…" : "Approval successful, creating schedule...");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Approval failed");
        setIsSubmitting(false);
        return;
      }
    }

    // Approve GasTank only when not using batched create (batched path pulls plan+gas in one tx to vault)
    if (!useBatchedCreate && gasNeededAtCreate > 0n && contracts.GasTank && (allowanceGasTank ?? 0n) < gasNeededAtCreate) {
      setIsSubmitting(true);
      try {
        await approve(formatUnits(gasNeededAtCreate, 6), contracts.GasTank);
        setSuccessMessage("Approving… Creating schedule...");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Approval failed");
        setIsSubmitting(false);
        return;
      }
    }

    if (!selectedTokenAddress) {
      setError("Please select a token");
      return;
    }

    enableAutoExecForCreateRef.current = enableAutoExec;
    requiredGasForPlanRef.current = gasNeededAtCreate;
    useBatchedCreateRef.current = useBatchedCreate;

    try {
      setIsSubmitting(true);
      setError(null);

      let txHash: `0x${string}`;
      if (useBatchedCreate) {
        const tryBatched = async (gasOverrides?: {
          maxFeePerGas?: bigint;
          maxPriorityFeePerGas?: bigint;
        }) =>
          createScheduleAndEnrollWithGas(
            selectedTokenAddress,
            frequency as 0 | 1 | 2 | 3 | 4,
            amountPerInterval,
            totalAmount,
            formatUnits(gasNeededAtCreate, 6),
            gasOverrides
          );
        try {
          txHash = await tryBatched();
        } catch (firstErr) {
          const msg = firstErr instanceof Error ? firstErr.message : String(firstErr);
          const isUnderpriced =
            msg.includes("underpriced") || msg.includes("replacement transaction underpriced");
          if (isUnderpriced && chainId) {
            setSuccessMessage("Retrying with higher gas…");
            const bumped = await getBumpedGasOptions(chainId);
            txHash = await tryBatched(bumped);
          } else {
            throw firstErr;
          }
        }
      } else {
        const tryCreate = async (gasOverrides?: {
          maxFeePerGas?: bigint;
          maxPriorityFeePerGas?: bigint;
        }) =>
          createSchedule(
            selectedTokenAddress,
            frequency as 0 | 1 | 2 | 3 | 4,
            amountPerInterval,
            totalAmount,
            gasOverrides
          );
        try {
          txHash = await tryCreate();
        } catch (firstErr) {
          const msg = firstErr instanceof Error ? firstErr.message : String(firstErr);
          const isUnderpriced =
            msg.includes("underpriced") || msg.includes("replacement transaction underpriced");
          if (isUnderpriced && chainId) {
            setSuccessMessage("Retrying with higher gas…");
            const bumped = await getBumpedGasOptions(chainId);
            txHash = await tryCreate(bumped);
          } else {
            throw firstErr;
          }
        }
      }
      if (address && chainId) {
        fetch("/api/automation/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chainId, userAddress: address }),
        }).catch(() => {});
      }

      setSuccessMessage("Transaction submitted. Confirming…");
      setAmountPerInterval("");
      setRunCount("");
      setToken(allTokenOptions[0]?.address ?? "");
      setFrequency(FREQUENCY_OPTIONS[0]?.id ?? 1);
      setPendingCreateTxHash(txHash);
      // Dashboard reload runs in useEffect when createReceipt.status === "success"
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create schedule");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Confirm add token modal */}
      {pendingToken && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-token-title"
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-hidden />
          <div
            className="relative w-full max-w-md rounded-2xl border border-[var(--hero-muted)]/15 bg-[var(--background)] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="confirm-token-title" className="text-lg font-semibold text-[var(--foreground)]">
              Token details
            </h3>
            <p className="mt-1 text-sm text-[var(--hero-muted)]">
              Confirm this token to add it to your selectable list.
            </p>
            <dl className="mt-4 space-y-3 rounded-xl bg-[var(--hero-muted)]/5 p-4 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-[var(--hero-muted)]">Name</dt>
                <dd className="font-medium text-[var(--foreground)]">{pendingToken.name}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[var(--hero-muted)]">Symbol</dt>
                <dd className="font-medium text-[var(--foreground)]">{pendingToken.symbol}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[var(--hero-muted)]">Decimals</dt>
                <dd className="font-medium text-[var(--foreground)]">{pendingToken.decimals}</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-[var(--hero-muted)]">Contract address</dt>
                <dd className="break-all font-mono text-xs text-[var(--foreground)]">
                  {pendingToken.address}
                </dd>
              </div>
            </dl>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={handleCancelAddToken}
                className="flex-1 rounded-xl border-2 border-[var(--hero-muted)]/20 px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--hero-muted)]/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmAddToken()}
                disabled={isFetchingLogo}
                className="flex-1 rounded-xl bg-[var(--hero-primary)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-70"
              >
                {isFetchingLogo ? "Fetching logo…" : "Confirm & add token"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage custom tokens modal */}
      {manageCustomTokensOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="manage-custom-tokens-title"
        >
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            aria-hidden
            onClick={() => setManageCustomTokensOpen(false)}
          />
          <div
            className="relative w-full max-w-md rounded-2xl border border-[var(--hero-muted)]/15 bg-[var(--background)] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4">
              <h3 id="manage-custom-tokens-title" className="text-lg font-semibold text-[var(--foreground)]">
                Custom tokens
                {chainId != null && CHAIN_NAMES[chainId] && (
                  <span className="ml-1.5 font-normal text-[var(--hero-muted)]">({CHAIN_NAMES[chainId]})</span>
                )}
              </h3>
              <button
                type="button"
                onClick={() => setManageCustomTokensOpen(false)}
                className="rounded-lg p-1 text-[var(--hero-muted)] transition-colors hover:bg-[var(--hero-muted)]/10 hover:text-[var(--foreground)]"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {customTokens.length === 0 ? (
              <p className="mt-4 text-sm text-[var(--hero-muted)]">
                No custom tokens on this network. Add one via the contract address field above.
              </p>
            ) : (
              <ul className="mt-4 max-h-72 space-y-1 overflow-auto">
                {customTokens.map((t) => (
                  <li
                    key={t.address}
                    className="flex items-center gap-3 rounded-xl border border-[var(--hero-muted)]/15 bg-[var(--hero-muted)]/5 px-3 py-2.5"
                  >
                    <TokenLogo logo={getTokenLogoUrl(chainId ?? 0, t.address, t.logo) ?? t.logo} symbol={t.symbol} name={t.name} className="h-8 w-8" />
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-[var(--foreground)]">
                        {t.name} ({t.symbol})
                      </span>
                      <p className="truncate font-mono text-xs text-[var(--hero-muted)]">{t.address}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveCustomToken(t.address)}
                      className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-500/10"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setManageCustomTokensOpen(false)}
                className="rounded-xl border-2 border-[var(--hero-muted)]/20 px-4 py-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--hero-muted)]/10"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        ref={overlayRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-dca-title"
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={handleOverlayClick}
      >
        <div
          className="absolute inset-0 bg-black/40 backdrop-blur-md transition-opacity"
          aria-hidden
        />
      <div
        ref={contentRef}
        className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-[var(--hero-muted)]/10 bg-[var(--background)] shadow-2xl shadow-black/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — warm and clear */}
        <div
          className="flex shrink-0 items-center justify-between px-5 py-4 text-white"
          style={{
            background: "linear-gradient(135deg, var(--hero-primary) 0%, var(--hero-secondary) 100%)",
            boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
          }}
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 shadow-inner">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </span>
            <div className="min-w-0">
              <h2 id="new-dca-title" className="text-lg font-semibold leading-tight tracking-tight">
                Create your DCA plan
              </h2>
              <p className="mt-0.5 truncate text-sm text-white/90">
                Set it once — we&apos;ll take care of the rest
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-2 shrink-0 rounded-xl p-2 text-white/90 transition-colors hover:bg-white/20 hover:text-white"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div className="space-y-5 p-5">
            {/* Balance & total — soft card */}
            {isConnected && (
              <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-gradient-to-br from-[var(--hero-primary)]/8 to-[var(--hero-secondary)]/5 border border-[var(--hero-primary)]/10 px-4 py-3 text-sm">
                <span className="flex items-center gap-1.5">
                  <span className="text-[var(--hero-muted)]">Balance</span>
                  <span className="font-semibold text-[var(--hero-primary)]">
                    {balanceFormatted.toFixed(2)} USDC
                  </span>
                </span>
                {totalRuns > 0 && amountPerInterval && (
                  <>
                    <span className="text-[var(--hero-muted)]">·</span>
                    <span className="text-xs text-[var(--hero-muted)]">
                      Plan: ${(parseFloat(amountPerInterval) * totalRuns).toFixed(2)}
                    </span>
                    {gasAddedAtCreate && requiredGasFormatted > 0 && (
                      <>
                        <span className="text-[var(--hero-muted)]">·</span>
                        <span className="text-xs text-[var(--hero-muted)]">
                          Gas (auto): ${requiredGasFormatted.toFixed(2)}
                        </span>
                        <span className="text-[var(--hero-muted)]">·</span>
                        <span className="text-xs font-semibold text-[var(--foreground)]">
                          Total:{" "}
                          {(parseFloat(amountPerInterval) * totalRuns + requiredGasFormatted).toFixed(2)}{" "}
                          USDC
                        </span>
                      </>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Token */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-sm font-medium text-[var(--foreground)]">Token to buy</label>
                {customTokens.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setManageCustomTokensOpen(true)}
                    className="text-xs font-medium text-[var(--hero-primary)] hover:underline"
                  >
                    Manage ({customTokens.length})
                  </button>
                )}
              </div>
              {isLoadingTokens && tokensList.length === 0 ? (
                <div className="flex h-10 items-center rounded-xl border border-[var(--hero-muted)]/15 px-3 text-sm text-[var(--hero-muted)]">
                  Loading…
                </div>
              ) : (
                <>
                  <TokenDropdown value={token} onChange={(v) => setToken(v)} options={allTokenOptions} />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Paste token contract address"
                      value={customTokenInput}
                      onChange={(e) => { setCustomTokenInput(e.target.value); setAddTokenError(null); }}
                      disabled={!!addingAddress}
                      className="min-w-0 flex-1 rounded-lg border border-[var(--hero-muted)]/15 bg-[var(--foreground)]/[0.02] px-2.5 py-1.5 text-xs placeholder:text-[var(--hero-muted)] focus:border-[var(--hero-primary)]/40 focus:outline-none focus:ring-1 focus:ring-[var(--hero-primary)]/20"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomToken}
                      disabled={!!addingAddress || !customTokenInput.trim()}
                      className="shrink-0 rounded-lg bg-[var(--hero-primary)]/15 px-2.5 py-1.5 text-xs font-medium text-[var(--hero-primary)] hover:bg-[var(--hero-primary)]/25 disabled:opacity-50"
                    >
                      {addingAddress && isLoadingCustomToken ? "…" : "Add"}
                    </button>
                  </div>
                  {addTokenError && <p className="text-xs text-red-500">{addTokenError}</p>}
                </>
              )}
            </div>

            {/* Amounts */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="dca-amount" className="text-sm font-medium text-[var(--foreground)]">
                  Amount per run
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--hero-muted)]">$</span>
                  <input
                    id="dca-amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="10"
                    value={amountPerInterval}
                    onChange={(e) => setAmountPerInterval(e.target.value)}
                    className="w-full rounded-xl border border-[var(--hero-muted)]/15 bg-[var(--foreground)]/[0.02] py-2.5 pl-8 pr-3 text-sm font-medium placeholder:text-[var(--hero-muted)] focus:border-[var(--hero-primary)]/40 focus:outline-none focus:ring-2 focus:ring-[var(--hero-primary)]/15"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="dca-runs" className="text-sm font-medium text-[var(--foreground)]">
                  Number of runs
                </label>
                <input
                  id="dca-runs"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="10"
                  value={runCount}
                  onChange={(e) => setRunCount(e.target.value)}
                  className="w-full rounded-xl border border-[var(--hero-muted)]/15 bg-[var(--foreground)]/[0.02] py-2.5 px-3 text-sm font-medium placeholder:text-[var(--hero-muted)] focus:border-[var(--hero-primary)]/40 focus:outline-none focus:ring-2 focus:ring-[var(--hero-primary)]/15"
                />
              </div>
            </div>
            {amountPerInterval && runCountNum > 0 && parseFloat(amountPerInterval) > 0 && (
              <p className="text-sm text-[var(--hero-muted)]">
                {totalRuns} run{totalRuns !== 1 ? "s" : ""} · swapped into {selectedOption?.symbol ?? "your token"} each time
              </p>
            )}

            {/* Frequency */}
            <div className="space-y-2">
              <span className="text-sm font-medium text-[var(--foreground)]">How often</span>
              <div className="flex flex-wrap gap-2 rounded-xl border border-[var(--hero-muted)]/10 bg-[var(--hero-muted)]/[0.03] p-1.5" role="group" aria-label="Frequency">
                {FREQUENCY_OPTIONS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFrequency(f.id)}
                    className={`rounded-lg px-3.5 py-2 text-xs font-medium transition-all ${
                      frequency === f.id
                        ? "bg-[var(--hero-primary)] text-white shadow-md shadow-[var(--hero-primary)]/25"
                        : "text-[var(--hero-muted)] hover:bg-[var(--hero-muted)]/10 hover:text-[var(--foreground)]"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Auto-executor: toggle when available; friendly info card when limit reached */}
            {enrolledCount >= 1 ? (
              <div className="rounded-2xl border border-[var(--hero-muted)]/15 bg-[var(--hero-muted)]/[0.06] p-4">
                <div className="flex items-start gap-3">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--hero-muted)]/15 text-[var(--hero-muted)]"
                    aria-hidden
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--foreground)]">
                      Auto-execution on your other plan
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-[var(--hero-muted)]">
                      Your one free auto-execution slot is in use on this network. This plan will run manually — you can
                      execute it anytime from the dashboard.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div
                className={`relative overflow-hidden rounded-2xl p-[1px] ${
                  enableAutoExec
                    ? "bg-[linear-gradient(120deg,color-mix(in_srgb,var(--hero-primary)_85%,white_15%),color-mix(in_srgb,var(--hero-secondary)_78%,white_22%),color-mix(in_srgb,var(--hero-accent)_80%,white_20%))] shadow-[0_10px_34px_rgba(139,92,246,0.28)]"
                    : "border border-[var(--hero-muted)]/10 bg-[var(--hero-muted)]/[0.04]"
                }`}
              >
                {enableAutoExec && (
                  <div
                    className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full opacity-60"
                    style={{
                      background:
                        "radial-gradient(circle, color-mix(in_srgb,var(--hero-primary)_30%,white_70%) 0%, transparent 70%)",
                    }}
                    aria-hidden
                  />
                )}
                <button
                  type="button"
                  onClick={() => setEnableAutoExec((v) => !v)}
                  className={`relative flex w-full items-center gap-3 rounded-[15px] px-3.5 py-3 text-xs font-medium transition-all ${
                    enableAutoExec
                      ? "border border-white/10 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--hero-primary)_35%,var(--background)_65%),color-mix(in_srgb,var(--hero-secondary)_28%,var(--background)_72%))] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]"
                      : "border border-[var(--hero-muted)]/20 bg-[var(--background)]/80 text-[var(--foreground)] hover:border-[var(--hero-primary)]/40 hover:bg-[var(--hero-primary)]/5"
                  }`}
                  aria-pressed={enableAutoExec}
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1 text-left">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                          enableAutoExec ? "bg-white/15 text-white" : "bg-[var(--hero-primary)]/10 text-[var(--hero-primary)]"
                        }`}
                        aria-hidden
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </span>
                      <span className={enableAutoExec ? "font-semibold tracking-wide" : "font-semibold"}>Auto-executor</span>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${
                          enableAutoExec
                            ? "bg-white/18 text-white shadow-[0_0_12px_rgba(255,255,255,0.22)]"
                            : "bg-[var(--hero-primary)]/15 text-[var(--hero-primary)]"
                        }`}
                      >
                        {enrolledCount === 0 ? "Free plan" : "Extra plan"}
                      </span>
                    </div>
                    <p
                      className={`text-[10px] leading-relaxed ${
                        enableAutoExec ? "text-white/86" : "text-[var(--hero-muted)]"
                      }`}
                    >
                      {enrolledCount === 0
                        ? "Your first plan includes daily auto-execution. Keep it on for a fully hands-off experience."
                        : "Add this plan to auto-execution, or leave it manual and run it whenever you like."}
                    </p>
                  </div>
                  <span
                    className={`ml-auto inline-flex min-w-[40px] items-center justify-center rounded-full px-2.5 py-1 text-[10px] font-bold ${
                      enableAutoExec
                        ? "bg-white/20 text-white shadow-[0_0_14px_rgba(255,255,255,0.28)]"
                        : "bg-[var(--hero-muted)]/20 text-[var(--hero-muted)]"
                    }`}
                  >
                    {enableAutoExec ? "On" : "Off"}
                  </span>
                </button>
              </div>
            )}

          </div>

          <div className="flex shrink-0 gap-3 border-t border-[var(--hero-muted)]/10 bg-[var(--hero-muted)]/[0.02] p-5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-[var(--hero-muted)]/20 py-3 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--hero-muted)]/10"
            >
              Maybe later
            </button>
            <button
              type="submit"
              disabled={
                !isConnected ||
                !amountPerInterval ||
                !runCount ||
                Number(amountPerInterval) <= 0 ||
                runCountNum < 1 ||
                isSubmitting ||
                isCreating ||
                isApproving ||
                !hasEnoughBalanceForCreate
              }
              className="flex-1 rounded-xl py-3 text-sm font-semibold text-white shadow-lg shadow-[var(--hero-primary)]/25 transition-all disabled:opacity-50 hover:opacity-95 hover:shadow-xl hover:shadow-[var(--hero-primary)]/30"
              style={{ background: "linear-gradient(135deg, var(--hero-primary), var(--hero-secondary))" }}
            >
              {isSubmitting || isCreating || isApproving ? (isApproving ? "Approving…" : "Creating…") : "Create my plan"}
            </button>
          </div>
        </form>
      </div>
    </div>

      {/* Progress modal — creating state */}
      {(isSubmitting || isCreating || isApproving || pendingCreateTxHash) && (
        <div
          className="fixed inset-0 z-[55] flex items-center justify-center p-4"
          aria-modal="true"
          role="dialog"
          aria-label="Creating DCA plan"
        >
          <div className="absolute inset-0 bg-black/30 backdrop-blur-md" aria-hidden />
          <div className="relative w-full max-w-sm rounded-3xl border border-[var(--hero-muted)]/10 bg-[var(--background)] p-6 shadow-2xl shadow-black/15">
            <div className="flex items-start gap-4">
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
                <div className="absolute inset-0 animate-spin rounded-full border-2 border-[var(--hero-primary)]/20 border-t-[var(--hero-primary)]" />
                <span className="text-xl">✨</span>
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-base font-semibold text-[var(--foreground)]">
                  We&apos;re creating your plan…
                </p>
                <p className="mt-1 text-sm text-[var(--hero-muted)]">
                  You&apos;ll be all set in just a moment. We&apos;re securing everything on-chain.
                </p>
              </div>
            </div>
            {pendingCreateTxHash && (
              <div className="mt-5 rounded-xl bg-[var(--hero-muted)]/5 px-4 py-3">
                <p className="text-xs font-medium text-[var(--hero-muted)]">
                  Transaction
                </p>
                <p className="mt-1 truncate text-xs text-[var(--foreground)]">
                  {pendingCreateTxHash}
                </p>
              </div>
            )}
            <ul className="mt-5 space-y-2.5 text-sm text-[var(--hero-muted)]">
              <li className="flex items-center gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--hero-muted)]/10 text-xs">
                  {isApproving ? "⏳" : "✓"}
                </span>
                Approving USDC for your plan
              </li>
              <li className="flex items-center gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--hero-muted)]/10 text-xs">
                  {pendingCreateTxHash && !createReceipt ? "⏳" : pendingCreateTxHash ? "✓" : "·"}
                </span>
                Confirming on-chain
              </li>
              {enableAutoExecForCreateRef.current && (
                <li className="flex items-center gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--hero-muted)]/10 text-xs">·</span>
                  Enrolling in auto-execution
                </li>
              )}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
