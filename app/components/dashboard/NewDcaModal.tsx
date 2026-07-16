"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { useAccount, useBalance, useReadContract, useReadContracts, useWaitForTransactionReceipt } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { useDCAVault, useDCAVaultRead, useTokenApproval, useTokenAllowance, useContracts, useGasTank, useGasTankAllChains, useGasCostPerExecutionForChain, requiredGasUsdc6Exact } from "@/app/hooks";
import { getGasCostPerRunUsd } from "@/config/gas-cost-env";
import { CHAIN_NAMES, FREQUENCY_MAP } from "@/lib/constants";
import { useSupportedTokens } from "@/app/hooks/useSupportedTokens";
import { DCA_VAULT_ABI, ERC20_ABI } from "@/config/abis";
import { decodeEventLog } from "viem";
import { FREQUENCY_OPTIONS, type FrequencyOptionId } from "@/config/frequencies-env";
import { getTokenLogoUrl } from "@/lib/token-logo";
import { formatUnits, getAddress, isAddress, parseUnits } from "viem";
import { getBumpedGasOptions } from "@/lib/get-bumped-gas";

const CUSTOM_TOKENS_STORAGE_KEY = "steadystake-custom-tokens";

/** Seconds between buys, per frequency id — used only to estimate when a plan finishes. */
const CADENCE_SECONDS: Record<number, number> = {
  0: 60,
  1: 86_400,
  2: 604_800,
  3: 1_209_600,
  4: 2_592_000,
};

/** Amount-per-run presets. Nothing magic — they just save four taps. */
const QUICK_AMOUNTS = [10, 25, 50, 100];

/** The receipt draws at most this many bars; past it, the count is stated instead. */
const MAX_BARS = 14;

const usd = (n: number, dp = 2) =>
  n.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });

/** "in ~8 min" while a plan is short, a calendar date once it spans days. */
function formatFinish(totalSeconds: number): string {
  if (totalSeconds <= 0) return "—";
  if (totalSeconds < 3600) return `in ~${Math.max(1, Math.round(totalSeconds / 60))} min`;
  if (totalSeconds < 86_400) return `in ~${Math.max(1, Math.round(totalSeconds / 3600))} hr`;
  return new Date(Date.now() + totalSeconds * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

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

/** The stages a create can be in. Only one is ever active, and it is the truth. */
type Stage = "approving" | "signing" | "confirming" | "enrolling" | "done";

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
        className="dm-token-btn"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <TokenLogo logo={selected?.logo} symbol={selected?.symbol ?? "?"} name={selected?.name} className="h-7 w-7" />
        <span className="dm-token-name">
          {selected?.name ?? "Select a token"}
          {selected?.symbol && <span className="dm-token-sym">{selected.symbol}</span>}
        </span>
        {selected?.isCustom && <span className="dm-tag">Custom</span>}
        <svg className="dm-token-caret" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          className="dm-pop"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="dm-pop-search">
            <input
              type="text"
              placeholder="Search name, symbol or address…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") e.preventDefault();
              }}
              autoFocus
              className="dm-input"
            />
          </div>
          <ul className="dm-pop-list" role="listbox">
            {filtered.length === 0 ? (
              <li className="dm-pop-empty">No tokens match that search.</li>
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
                    className={`dm-pop-item ${
                      value?.toLowerCase() === t.address.toLowerCase() ? "is-selected" : ""
                    }`}
                  >
                    <TokenLogo logo={t.logo} symbol={t.symbol} name={t.name} className="h-7 w-7" />
                    <span className="dm-token-name">
                      {t.name}
                      <span className="dm-token-sym">{t.symbol}</span>
                    </span>
                    {t.isCustom && <span className="dm-tag">Custom</span>}
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

  /** Which stage the create is in, and which steps this particular create needs.
      Both are set at submit, so the progress rail never invents a step. */
  const [stage, setStage] = useState<Stage | null>(null);
  const [flow, setFlow] = useState<{ approve: boolean; enroll: boolean; batched: boolean }>({
    approve: false,
    enroll: false,
    batched: false,
  });

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
    // Escape must not unmount us mid-transaction: the effect that waits for the
    // receipt (and then enrolls for auto-execution) lives here and would die with it.
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !stage) onClose();
    };
    document.addEventListener("keydown", onEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onEscape);
      document.body.style.overflow = "";
    };
  }, [open, onClose, stage]);

  // When modal closes, clear pending create hash and batched ref so we don't run refresh logic on reopen
  useEffect(() => {
    if (!open) {
      setPendingCreateTxHash(undefined);
      setStage(null);
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

      // Record the plan to the database now that it is confirmed on-chain. This is what lets the
      // dashboard and executor read plans without scanning block logs, so do it before enrolling —
      // an enroll failure must not cost us the record. The server re-reads the receipt itself.
      if (chainId && pendingCreateTxHash) {
        try {
          const res = await fetch("/api/plans/record", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chainId, txHash: pendingCreateTxHash }),
          });
          if (!res.ok) {
            // Not fatal: the plan exists on-chain and a manual reindex can still recover it.
            console.error("[NewDcaModal] plan record failed:", await res.text());
          }
        } catch (e) {
          console.error("[NewDcaModal] plan record failed:", e);
        }
      }

      if (enableAutoExecForCreateRef.current && scheduleId != null && address && contracts.DCAVault && !useBatchedCreateRef.current) {
        setStage("enrolling");
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
          setSuccessMessage("Schedule created and enrolled for auto-execution.");
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
      setStage("done");
      setPendingCreateTxHash(undefined);
      setTimeout(() => {
        onClose();
        setStage(null);
        setSuccessMessage(null);
      }, 1500);
    };
    void run();
  }, [pendingCreateTxHash, createReceipt, queryClient, onClose, enrolledCount, additionalAutoPlanFeeUsdc6, enrollForAutoExecution, approve, address, chainId, contracts.DCAVault, refetchCount, depositToGasTank]);

  // If tx reverted, show error and stop pending state
  useEffect(() => {
    if (pendingCreateTxHash && createReceipt?.status === "reverted") {
      setError("Transaction reverted. Please try again.");
      setPendingCreateTxHash(undefined);
      setIsSubmitting(false);
      setStage(null);
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
    // While a transaction is in flight, a stray click outside must not close the modal.
    if (stage) return;
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

    if (!selectedTokenAddress) {
      setError("Please select a token");
      return;
    }

    // Work out the exact shape of this create *before* running it, so the progress
    // rail lists the steps that will actually happen — no more, no fewer.
    const approvalAmount = useBatchedCreate ? (totalAmountBig + gasNeededAtCreate) : totalAmountBig;
    const needsVaultApproval = allowance < approvalAmount;
    const needsGasTankApproval = Boolean(
      !useBatchedCreate &&
        gasNeededAtCreate > 0n &&
        contracts.GasTank &&
        (allowanceGasTank ?? 0n) < gasNeededAtCreate
    );
    const willEnrollAfterCreate = enableAutoExec && !useBatchedCreate;

    setFlow({
      approve: needsVaultApproval || needsGasTankApproval,
      enroll: willEnrollAfterCreate,
      batched: useBatchedCreate,
    });

    // Approve DCAVault: one approval for plan (or plan+gas when batched)
    if (needsVaultApproval) {
      setIsSubmitting(true);
      setStage("approving");
      try {
        await approve(formatUnits(approvalAmount, 6), contracts.DCAVault);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Approval failed");
        setIsSubmitting(false);
        setStage(null);
        return;
      }
    }

    // Approve GasTank only when not using batched create (batched path pulls plan+gas in one tx to vault)
    if (needsGasTankApproval) {
      setIsSubmitting(true);
      setStage("approving");
      try {
        await approve(formatUnits(gasNeededAtCreate, 6), contracts.GasTank);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Approval failed");
        setIsSubmitting(false);
        setStage(null);
        return;
      }
    }

    enableAutoExecForCreateRef.current = enableAutoExec;
    requiredGasForPlanRef.current = gasNeededAtCreate;
    useBatchedCreateRef.current = useBatchedCreate;

    try {
      setIsSubmitting(true);
      setStage("signing");
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

      setAmountPerInterval("");
      setRunCount("");
      setToken(allTokenOptions[0]?.address ?? "");
      setFrequency(FREQUENCY_OPTIONS[0]?.id ?? 1);
      setPendingCreateTxHash(txHash);
      setStage("confirming");
      // Dashboard reload runs in useEffect when createReceipt.status === "success"
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create schedule");
      setStage(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  // ---- Derived view model. Everything the receipt shows comes from here. ----
  const amountNum = parseFloat(amountPerInterval) || 0;
  const hasPlan = amountNum > 0 && runCountNum >= 1;
  const planTotal = amountNum * runCountNum;
  const grandTotal = gasAddedAtCreate ? planTotal + requiredGasFormatted : planTotal;
  const remainingAfter = balanceFormatted - grandTotal;
  const shortfall = grandTotal - balanceFormatted;
  const buySymbol = selectedOption?.symbol ?? "your token";
  const chainName = chainId != null ? CHAIN_NAMES[chainId] : undefined;
  const cadenceLabel = FREQUENCY_OPTIONS.find((f) => f.id === frequency)?.label ?? "Daily";
  const cadenceEvery = FREQUENCY_MAP[frequency] ?? "1 day";
  const freqIndex = Math.max(0, FREQUENCY_OPTIONS.findIndex((f) => f.id === frequency));
  const finishLabel = hasPlan
    ? formatFinish((CADENCE_SECONDS[frequency] ?? 86_400) * runCountNum)
    : "—";

  // Illustrative, not live data: one bar per scheduled buy, rising as the position builds.
  const barCount = Math.min(runCountNum, MAX_BARS);
  const wobble = [0, 7, -5, 4, -7, 6, -3, 5, -6, 3, -4, 7, -5, 2];
  const bars = Array.from({ length: barCount }, (_, i) => {
    const ramp = 32 + (barCount === 1 ? 40 : (i / (barCount - 1)) * 56);
    return Math.max(14, Math.min(100, ramp + wobble[i % wobble.length]));
  });
  const isBusy = stage !== null || isSubmitting || isCreating || isApproving;
  const canSubmit =
    isConnected && hasPlan && Boolean(selectedTokenAddress) && hasEnoughBalanceForCreate && !isBusy;

  const footHint = !isConnected
    ? "Connect your wallet to create a plan."
    : !amountNum
      ? "Enter how much USDC to spend on each run."
      : runCountNum < 1
        ? "Choose how many runs this plan should make."
        : !hasEnoughBalanceForCreate
          ? `You need $${usd(Math.max(shortfall, 0))} more USDC for this plan.`
          : null;

  /** The steps this create will take, in order. Built from the flow captured at submit. */
  const steps: { id: Stage; label: string; note: string }[] = [
    ...(flow.approve
      ? [
          {
            id: "approving" as const,
            label: "Approve USDC",
            note: "Let the vault pull the funds for this plan.",
          },
        ]
      : []),
    {
      id: "signing" as const,
      label: "Confirm in your wallet",
      note: flow.batched
        ? "Signs the plan and its auto-execution together."
        : "Signs the transaction that creates your plan.",
    },
    {
      id: "confirming" as const,
      label: "Confirming on-chain",
      note: chainName ? `Waiting for ${chainName} to include it.` : "Waiting for the network.",
    },
    ...(flow.enroll
      ? [
          {
            id: "enrolling" as const,
            label: "Enrolling in auto-execution",
            note: "We take it from here — every buy runs on schedule.",
          },
        ]
      : []),
  ];
  const stageIndex = stage === "done" ? steps.length : steps.findIndex((s) => s.id === stage);

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
                className="ss-btn ss-btn-soft ss-btn-sm flex-1"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmAddToken()}
                disabled={isFetchingLogo}
                data-loading={isFetchingLogo ? "true" : undefined}
                className="ss-btn ss-btn-primary ss-btn-sm flex-1"
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
                {chainName && (
                  <span className="ml-1.5 font-normal text-[var(--hero-muted)]">({chainName})</span>
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
                      className="ss-btn ss-btn-danger ss-btn-sm shrink-0"
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
                className="ss-btn ss-btn-soft ss-btn-sm"
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
        className="dm-overlay"
        onClick={handleOverlayClick}
      >
        <div className="dm-veil" aria-hidden>
          <span className="dm-veil-bloom dm-veil-bloom-a" />
          <span className="dm-veil-bloom dm-veil-bloom-b" />
        </div>

        <div ref={contentRef} className="dm-shell" onClick={(e) => e.stopPropagation()}>
          <span className="dm-edge" aria-hidden />

          {/* Header */}
          <div className="dm-head">
            <span className="dm-head-grid" aria-hidden />
            <span className="dm-head-sheen" aria-hidden />

            <span className="dm-head-mark" aria-hidden>
              <span className="dm-head-ring" />
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="12" r="8.5" />
                <path strokeLinecap="round" d="M12 7.2v9.6M14.3 9.5c-.45-.85-1.3-1.4-2.3-1.4-1.3 0-2.35.85-2.35 2 0 2.75 4.7 1.5 4.7 4.25 0 1.15-1.05 2-2.35 2-1 0-1.85-.55-2.3-1.4" />
              </svg>
            </span>

            <div className="dm-head-copy">
              <h2 id="new-dca-title" className="dm-title">
                Create your DCA plan
                {chainName && <span className="dm-head-net">{chainName}</span>}
              </h2>
              <p className="dm-sub">Set it once — we&apos;ll take care of the rest.</p>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isBusy}
              className="dm-close"
              aria-label="Close"
            >
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="dm-form">
            <div className="dm-scroll">
              <div className="dm-grid">
                {/* ---------- Controls ---------- */}
                <div className="dm-main">
                  {isConnected && (
                    <div className="dm-balance">
                      <span className="dm-balance-icon" aria-hidden>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <rect x="3" y="6" width="18" height="13" rx="2.5" />
                          <path strokeLinecap="round" d="M3 10h18M7 15h3" />
                        </svg>
                      </span>
                      <span className="dm-balance-copy">
                        <span className="dm-balance-label">Your balance</span>
                        <span className="dm-balance-value">
                          {usd(balanceFormatted)}
                          <small>USDC</small>
                        </span>
                      </span>
                    </div>
                  )}

                  {/* Token */}
                  <div className="dm-field">
                    <div className="dm-field-head">
                      <label className="dm-label">
                        <span className="dm-label-num" aria-hidden>1</span>
                        Token to buy
                      </label>
                      {customTokens.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setManageCustomTokensOpen(true)}
                          className="dm-link"
                        >
                          Manage ({customTokens.length})
                        </button>
                      )}
                    </div>

                    {isLoadingTokens && tokensList.length === 0 ? (
                      <div className="dm-token-btn">
                        <span className="dm-hint">Loading tokens…</span>
                      </div>
                    ) : (
                      <>
                        <TokenDropdown value={token} onChange={(v) => setToken(v)} options={allTokenOptions} />
                        <div className="dm-add">
                          <input
                            type="text"
                            placeholder="Or paste a token contract address"
                            value={customTokenInput}
                            onChange={(e) => {
                              setCustomTokenInput(e.target.value);
                              setAddTokenError(null);
                            }}
                            disabled={!!addingAddress}
                            className="dm-input"
                          />
                          <button
                            type="button"
                            onClick={handleAddCustomToken}
                            disabled={!!addingAddress || !customTokenInput.trim()}
                            className="ss-btn ss-btn-soft ss-btn-sm shrink-0"
                          >
                            {addingAddress && isLoadingCustomToken ? "Reading…" : "Add"}
                          </button>
                        </div>
                        {addTokenError && <p className="dm-hint dm-hint-error">{addTokenError}</p>}
                      </>
                    )}
                  </div>

                  {/* Amounts */}
                  <div className="dm-field">
                    <label className="dm-label" htmlFor="dca-amount">
                      <span className="dm-label-num" aria-hidden>2</span>
                      How much, and how many times
                    </label>

                    <div className="dm-row">
                      <div className="dm-input-wrap">
                        <span className="dm-input-prefix" aria-hidden>$</span>
                        <input
                          id="dca-amount"
                          type="number"
                          min="0.01"
                          step="0.01"
                          placeholder="10"
                          value={amountPerInterval}
                          onChange={(e) => setAmountPerInterval(e.target.value)}
                          className="dm-input"
                          aria-label="Amount per run in USDC"
                        />
                      </div>
                      <div className="dm-input-wrap dm-input-wrap-suffix">
                        <input
                          id="dca-runs"
                          type="number"
                          min="1"
                          step="1"
                          placeholder="10"
                          value={runCount}
                          onChange={(e) => setRunCount(e.target.value)}
                          className="dm-input"
                          aria-label="Number of runs"
                        />
                        <span className="dm-input-suffix" aria-hidden>runs</span>
                      </div>
                    </div>

                    <div className="dm-quick">
                      {QUICK_AMOUNTS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setAmountPerInterval(String(preset))}
                          aria-pressed={amountNum === preset}
                          className="dm-quick-btn"
                        >
                          ${preset}
                        </button>
                      ))}
                      <span className="dm-quick-note">per run</span>
                    </div>
                  </div>

                  {/* Frequency */}
                  <div className="dm-field">
                    <label className="dm-label">
                      <span className="dm-label-num" aria-hidden>3</span>
                      How often
                    </label>
                    <div
                      className="dm-freq"
                      role="group"
                      aria-label="Frequency"
                      style={{
                        ["--dm-n" as string]: FREQUENCY_OPTIONS.length,
                        ["--dm-i" as string]: freqIndex,
                      }}
                    >
                      <span className="dm-freq-thumb" aria-hidden />
                      {FREQUENCY_OPTIONS.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setFrequency(f.id)}
                          aria-pressed={frequency === f.id}
                          className="dm-freq-btn"
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                    <p className="dm-hint">
                      One buy every <b>{cadenceEvery}</b>, starting as soon as the plan is live.
                    </p>
                  </div>

                  {/* Auto-executor */}
                  {enrolledCount >= 1 ? (
                    <div className="dm-note">
                      <span className="dm-note-icon" aria-hidden>
                        <svg fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </span>
                      <div className="min-w-0">
                        <p className="dm-note-title">Auto-execution is on your other plan</p>
                        <p className="dm-note-body">
                          Your one free auto-execution slot is in use on this network. This plan will run
                          manually — you can execute it anytime from the dashboard.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className={`dm-auto ${enableAutoExec ? "dm-auto-on" : ""}`}>
                      <button
                        type="button"
                        onClick={() => setEnableAutoExec((v) => !v)}
                        aria-pressed={enableAutoExec}
                        className="dm-auto-btn"
                      >
                        <span className="dm-auto-icon" aria-hidden>
                          <svg fill="none" stroke="currentColor" strokeWidth="2.1" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        </span>
                        <span className="dm-auto-copy">
                          <span className="dm-auto-title">
                            Auto-executor
                            <span className="dm-auto-badge">Free plan</span>
                          </span>
                          <span className="dm-auto-body">
                            {enableAutoExec
                              ? gasAddedAtCreate && requiredGasFormatted > 0
                                ? `We run every buy for you. $${usd(requiredGasFormatted)} of gas is prepaid with this plan.`
                                : "We run every buy for you — fully hands-off."
                              : "Off — you'll execute each buy yourself from the dashboard."}
                          </span>
                        </span>
                        <span className="dm-switch" aria-hidden />
                      </button>
                    </div>
                  )}
                </div>

                {/* ---------- The receipt ---------- */}
                <aside className="dm-aside">
                  <span className="dm-aside-mesh" aria-hidden />

                  <div className="dm-aside-body">
                    <div className="dm-aside-head">
                      <span className="dm-aside-title">Your plan</span>
                      {hasPlan && (
                        <span className="dm-live">
                          <span className="dm-live-dot" aria-hidden />
                          Preview
                        </span>
                      )}
                    </div>

                    <div className="dm-chart">
                      <span className="dm-chart-grid" aria-hidden />

                      {hasPlan ? (
                        <>
                          {runCountNum > MAX_BARS && (
                            <span className="dm-chart-cap">showing {MAX_BARS} of {runCountNum}</span>
                          )}
                          <div className="dm-bars" aria-hidden>
                            {bars.map((h, i) => (
                              <span
                                key={i}
                                className="dm-bar"
                                style={{
                                  height: `${h}%`,
                                  animationDelay: `${i * 55}ms`,
                                }}
                              />
                            ))}
                          </div>
                        </>
                      ) : (
                        <p className="dm-chart-empty">
                          Enter an amount and a number of runs — your plan will draw itself here.
                        </p>
                      )}
                    </div>

                    <div className="dm-facts">
                      <div className="dm-fact">
                        <span className="dm-fact-label">
                          <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
                            <circle cx="12" cy="12" r="9" />
                            <path strokeLinecap="round" d="M12 7v10M14.5 9.5c-.5-.9-1.4-1.5-2.5-1.5-1.4 0-2.5.9-2.5 2.1 0 2.9 5 1.6 5 4.5 0 1.2-1.1 2.1-2.5 2.1-1.1 0-2-.6-2.5-1.5" />
                          </svg>
                          Each buy
                        </span>
                        <span className="dm-fact-value">
                          {hasPlan ? `$${usd(amountNum)}` : "—"}
                        </span>
                      </div>

                      <div className="dm-fact">
                        <span className="dm-fact-label">
                          <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
                            <rect x="4" y="5" width="16" height="16" rx="2.5" />
                            <path strokeLinecap="round" d="M4 10h16M9 3v4M15 3v4" />
                          </svg>
                          Cadence
                        </span>
                        <span className="dm-fact-value">{cadenceLabel}</span>
                      </div>

                      <div className="dm-fact">
                        <span className="dm-fact-label">
                          <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 17l5-5 4 3 7-8" />
                            <path strokeLinecap="round" d="M15 7h5v5" />
                          </svg>
                          Buys {buySymbol}
                        </span>
                        <span className="dm-fact-value">
                          {hasPlan ? `${runCountNum}×` : "—"}
                        </span>
                      </div>

                      <div className="dm-fact">
                        <span className="dm-fact-label">
                          <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
                            <circle cx="12" cy="12" r="9" />
                            <path strokeLinecap="round" d="M12 7v5l3 2" />
                          </svg>
                          Finishes
                        </span>
                        <span className="dm-fact-value">{finishLabel}</span>
                      </div>
                    </div>

                    <div className="dm-cost">
                      <div className="dm-cost-row">
                        <span>Plan ({hasPlan ? `${runCountNum} × $${usd(amountNum)}` : "—"})</span>
                        <b>${usd(planTotal)}</b>
                      </div>

                      {gasAddedAtCreate && requiredGasFormatted > 0 && (
                        <div className="dm-cost-row">
                          <span>Gas, prepaid (${usd(costPerRunUsd, 3)}/run)</span>
                          <b>${usd(requiredGasFormatted)}</b>
                        </div>
                      )}

                      <div className="dm-cost-row dm-cost-total">
                        <span>Total today</span>
                        <b>${usd(grandTotal)}</b>
                      </div>

                      {hasPlan && hasEnoughBalanceForCreate && (
                        <div className="dm-cost-row">
                          <span>Left in wallet</span>
                          <b>${usd(Math.max(remainingAfter, 0))}</b>
                        </div>
                      )}

                      {hasPlan && !hasEnoughBalanceForCreate && (
                        <p className="dm-cost-warn">
                          <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.3 3.9L2 18a2 2 0 001.7 3h16.6a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
                          </svg>
                          ${usd(Math.max(shortfall, 0))} short of your balance.
                        </p>
                      )}

                      {gasTankBalanceFormatted > 0 && (
                        <div className="dm-cost-row">
                          <span>Gas tank (all networks)</span>
                          <b>${usd(gasTankBalanceFormatted)}</b>
                        </div>
                      )}
                    </div>
                  </div>
                </aside>
              </div>
            </div>

            {/* Footer */}
            <div className="dm-foot">
              <p className="dm-foot-hint">
                {footHint ?? (
                  <>
                    Buying <b>{buySymbol}</b> with <b>${usd(amountNum)}</b> every{" "}
                    <b>{cadenceEvery}</b>, {runCountNum} times.
                  </>
                )}
              </p>
              <button type="button" onClick={onClose} className="ss-btn ss-btn-soft" disabled={isBusy}>
                Maybe later
              </button>
              <button
                type="submit"
                disabled={!canSubmit || isLoadingAllowance}
                data-loading={isBusy ? "true" : undefined}
                className="ss-btn ss-btn-primary ss-btn-glow"
              >
                {isBusy ? "Working…" : "Create my plan"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Progress — one step is active, and it is the one really happening */}
      {stage && (
        <div className="dm-prog" aria-modal="true" role="dialog" aria-label="Creating DCA plan">
          <div className="dm-veil" aria-hidden />

          <div className="dm-prog-card">
            <span className="dm-prog-aura" aria-hidden />

            <div className="dm-prog-head">
              <span className="dm-prog-orb" aria-hidden>
                <svg fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </span>
              <div className="min-w-0">
                <p className="dm-prog-title">
                  {stage === "done" ? "Your plan is live" : "Creating your plan…"}
                </p>
                <p className="dm-prog-sub">
                  {stage === "done"
                    ? "Taking you back to the dashboard."
                    : "Keep this window open until every step is done."}
                </p>
              </div>
            </div>

            <ol className="dm-steps">
              {steps.map((step, i) => {
                const done = stageIndex > i;
                const active = stageIndex === i;
                return (
                  <li
                    key={step.id}
                    className={`dm-step ${done ? "dm-step-done" : ""} ${active ? "dm-step-active" : ""}`}
                    aria-current={active ? "step" : undefined}
                  >
                    <span className="dm-step-dot" aria-hidden>
                      {done ? (
                        <svg fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        i + 1
                      )}
                    </span>
                    <span className="dm-step-copy">
                      <span className="dm-step-label">{step.label}</span>
                      <span className="dm-step-note">{step.note}</span>
                    </span>
                  </li>
                );
              })}
            </ol>

            {pendingCreateTxHash && (
              <div className="dm-prog-tx">
                <p className="dm-prog-tx-label">Transaction</p>
                <p className="dm-prog-tx-hash">{pendingCreateTxHash}</p>
              </div>
            )}

            <p className="dm-prog-foot">
              Your wallet may ask you to confirm more than once — that&apos;s each step above.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
