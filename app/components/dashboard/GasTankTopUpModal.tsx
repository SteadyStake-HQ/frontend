"use client";

import { useEffect, useRef, useState } from "react";
import { useAccount, useBalance, useSwitchChain, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { useContracts } from "@/app/hooks/useContracts";
import { useGasTankAllChains, getChainsWithGasTank } from "@/app/hooks/useGasTank";
import { useTokenApproval, useTokenAllowance } from "@/app/hooks";
import { GAS_TANK_ABI, ERC20_ABI } from "@/config/abis";
import { getContracts } from "@/config/contracts";
import { CHAIN_NAMES } from "@/lib/constants";
import { formatUnits, parseUnits } from "viem";

const ZERO = "0x0000000000000000000000000000000000000000";

function ChainSelect({
  selectedChainId,
  chainIds,
  onSelect,
}: {
  selectedChainId: number;
  chainIds: number[];
  onSelect: (chainId: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  const selectedLabel = CHAIN_NAMES[selectedChainId] ?? `Chain ${selectedChainId}`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl border border-[var(--hero-muted)]/15 bg-[var(--foreground)]/[0.04] px-3 py-2.5 text-left text-sm text-[var(--foreground)] transition-colors focus:border-[var(--hero-primary)]/40 focus:outline-none focus:ring-1 focus:ring-[var(--hero-primary)]/20"
      >
        <span className="truncate font-medium">{selectedLabel}</span>
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
          <ul className="max-h-52 overflow-auto py-1" role="listbox">
            {chainIds.map((cid) => (
              <li key={cid} role="option" aria-selected={selectedChainId === cid}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(cid);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-[var(--hero-muted)]/10 ${
                    selectedChainId === cid
                      ? "bg-[var(--hero-primary)]/15 text-[var(--hero-primary)]"
                      : "text-[var(--foreground)]"
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate">
                    {CHAIN_NAMES[cid] ?? `Chain ${cid}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

interface GasTankTopUpModalProps {
  open: boolean;
  onClose: () => void;
}

export function GasTankTopUpModal({ open, onClose }: GasTankTopUpModalProps) {
  const { address, isConnected, chainId: walletChainId } = useAccount();
  const { chainId: contractsChainId, contracts } = useContracts();
  const chainsWithGasTank = getChainsWithGasTank();
  const { totalBalanceUsdc6, byChain } = useGasTankAllChains();
  const [selectedChainId, setSelectedChainId] = useState<number>(chainsWithGasTank[0] ?? 84532);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pendingApproveHash, setPendingApproveHash] = useState<`0x${string}` | undefined>(undefined);
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const { data: approveReceipt } = useWaitForTransactionReceipt({ hash: pendingApproveHash });

  const contractsForChain = getContracts(selectedChainId);
  const isOnSelectedChain = walletChainId === selectedChainId;
  const { switchChain } = useSwitchChain();
  const { approve, isLoading: isApproving } = useTokenApproval(
    isOnSelectedChain && contracts?.MockUSDC ? contracts.MockUSDC : ""
  );
  const { allowance, refetchAllowance } = useTokenAllowance(
    contracts?.MockUSDC ?? "",
    contracts?.GasTank ?? "",
    address
  );
  const { data: usdcBalance } = useBalance({
    address: address ?? undefined,
    token: (isOnSelectedChain ? contracts?.MockUSDC : contractsForChain?.MockUSDC) as `0x${string}`,
    chainId: selectedChainId,
  });
  const { writeContract: writeDeposit, isPending: isDepositing } = useWriteContract();

  const amountWei = amount ? parseUnits(amount, 6) : 0n;
  const gasTankAddr = isOnSelectedChain ? contracts?.GasTank : contractsForChain?.GasTank;
  const needsApproval = gasTankAddr && gasTankAddr !== ZERO && allowance < amountWei && amountWei > 0n;
  const canDeposit = isOnSelectedChain && amountWei > 0n && allowance >= amountWei && gasTankAddr && gasTankAddr !== ZERO;

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

  useEffect(() => {
    if (open && chainsWithGasTank.length > 0 && !chainsWithGasTank.includes(selectedChainId)) {
      setSelectedChainId(chainsWithGasTank[0]);
    }
  }, [open, chainsWithGasTank, selectedChainId]);

  // After approval tx is confirmed, refetch allowance so the button switches to Deposit
  useEffect(() => {
    if (approveReceipt?.status === "success" && pendingApproveHash) {
      refetchAllowance?.();
      setPendingApproveHash(undefined);
      setSuccess("Approved. You can deposit now.");
    }
  }, [approveReceipt?.status, pendingApproveHash, refetchAllowance]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (contentRef.current && !contentRef.current.contains(e.target as Node)) onClose();
  };

  const handleApprove = async () => {
    if (!amount || !contracts?.GasTank) return;
    setError(null);
    try {
      const hash = await approve(amount, contracts.GasTank);
      if (hash) {
        setPendingApproveHash(hash);
        setSuccess("Approving…");
      } else {
        await refetchAllowance?.();
        setSuccess("Approved. You can deposit now.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approval failed");
    }
  };

  const handleDeposit = async () => {
    if (!amount || !contracts?.GasTank || !address) return;
    setError(null);
    setSuccess(null);
    return new Promise<void>((resolve, reject) => {
      writeDeposit(
        {
          address: contracts.GasTank as `0x${string}`,
          abi: GAS_TANK_ABI,
          functionName: "deposit",
          args: [amountWei],
          chainId: selectedChainId,
        },
        {
          onSuccess: () => {
            setSuccess("Deposit successful.");
            setAmount("");
            resolve();
          },
          onError: (err) => {
            setError(err.message);
            reject(err);
          },
        }
      );
    });
  };

  if (!open) return null;

  const totalFormatted = Number(formatUnits(totalBalanceUsdc6, 6));

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="gas-tank-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={handleOverlayClick}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-md" aria-hidden />
      <div
        ref={contentRef}
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-[var(--hero-muted)]/10 bg-[var(--background)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Compact header */}
        <div
          className="flex items-center justify-between px-4 py-3 text-white"
          style={{
            background: "linear-gradient(135deg, var(--hero-primary) 0%, var(--hero-secondary) 100%)",
          }}
        >
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21h18M5 21V8l7-4 7 4v13M12 12v9M9 6h6M9 10h6" />
              </svg>
            </span>
            <div className="min-w-0">
              <h2 id="gas-tank-modal-title" className="text-base font-semibold leading-tight">
                Gas tank
              </h2>
              <p className="truncate text-xs text-white/80">
                Top up with USDC · Balance per network
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-2 shrink-0 rounded-lg p-1.5 text-white/90 transition-colors hover:bg-white/20"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 p-4">
          {/* Total balance */}
          {isConnected && (
            <div className="flex items-center justify-between rounded-xl bg-[var(--hero-primary)]/5 border border-[var(--hero-primary)]/10 px-4 py-3">
              <span className="text-sm text-[var(--hero-muted)]">Total balance</span>
              <span className="text-lg font-semibold tabular-nums text-[var(--hero-primary)]">
                ${totalFormatted.toFixed(2)} USDC
              </span>
            </div>
          )}

          {/* By network */}
          {chainsWithGasTank.length > 0 && (
            <div className="rounded-xl border border-[var(--hero-muted)]/10 bg-[var(--foreground)]/[0.02] p-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--hero-muted)]">
                By network
              </p>
              <ul className="space-y-1.5">
                {chainsWithGasTank.map((cid) => (
                  <li key={cid} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-[var(--foreground)]">{CHAIN_NAMES[cid] ?? `Chain ${cid}`}</span>
                    <span className="font-medium tabular-nums">${Number(formatUnits(byChain[cid] ?? 0n, 6)).toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Top up section */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-[var(--hero-muted)]">
              Top up on
            </label>
            <ChainSelect
              selectedChainId={selectedChainId}
              chainIds={chainsWithGasTank}
              onSelect={setSelectedChainId}
            />
          </div>

          {!isOnSelectedChain && (
            <div className="flex flex-col gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
              <p className="text-sm text-amber-700 dark:text-amber-400">
                Switch wallet to <strong>{CHAIN_NAMES[selectedChainId] ?? selectedChainId}</strong> to top up here.
              </p>
              <button
                type="button"
                onClick={() => switchChain?.({ chainId: selectedChainId })}
                className="rounded-lg bg-amber-500/20 px-3 py-2 text-sm font-medium text-amber-800 dark:text-amber-200 transition-colors hover:bg-amber-500/30"
              >
                Switch network
              </button>
            </div>
          )}

          {isOnSelectedChain && contracts?.GasTank && contracts.GasTank !== ZERO && (
            <div className="space-y-2">
              {usdcBalance && (
                <p className="text-xs text-[var(--hero-muted)]">
                  Your USDC: <span className="font-medium text-[var(--foreground)]">{Number(formatUnits(usdcBalance.value, 6)).toFixed(2)}</span>
                </p>
              )}
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => { setAmount(e.target.value); setError(null); setSuccess(null); }}
                className="w-full rounded-xl border border-[var(--hero-muted)]/15 bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--hero-muted)] focus:border-[var(--hero-primary)]/40 focus:outline-none focus:ring-2 focus:ring-[var(--hero-primary)]/20"
              />
              <div className="block w-full">
                {needsApproval ? (
                  <button
                    type="button"
                    disabled={!amount || isApproving || !!pendingApproveHash || isDepositing}
                    onClick={handleApprove}
                    className="w-full rounded-xl border border-[var(--hero-primary)]/30 bg-[var(--hero-primary)]/10 px-4 py-2.5 text-sm font-semibold text-[var(--hero-primary)] transition-colors hover:bg-[var(--hero-primary)]/15 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isApproving || pendingApproveHash ? "Confirming…" : "Approve & Deposit"}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!canDeposit || isDepositing}
                    onClick={() => handleDeposit()}
                    className="w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: "linear-gradient(135deg, var(--hero-primary), var(--hero-secondary))" }}
                  >
                    {isDepositing ? "Confirming…" : "Deposit"}
                  </button>
                )}
              </div>
            </div>
          )}

          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          {success && (
            <p className="rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">{success}</p>
          )}
        </div>
      </div>
    </div>
  );
}
