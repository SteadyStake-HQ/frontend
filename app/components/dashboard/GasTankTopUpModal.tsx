"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { toast } from "react-toastify";
import {
  useAccount,
  useBalance,
  usePublicClient,
  useReadContract,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import {
  useGasTankAllChains,
  useGasTankLevel,
  useGasTankRefresh,
  getChainsWithGasTank,
} from "@/app/hooks/useGasTank";
import { GAS_TANK_ABI, ERC20_ABI } from "@/config/abis";
import { getContracts } from "@/config/contracts";
import {
  useRunCostBreakdown,
  formatNativeAmount,
  formatUsdPrice,
} from "@/app/hooks/useRunCost";
import { CHAIN_ICON_URLS, getNativeSymbol } from "@/config/wagmi";
import { GAS_UNITS_PER_RUN } from "@/config/gas-cost-env";
import { CHAIN_NAMES } from "@/lib/constants";
import { formatUnits, parseUnits } from "viem";
import { parseTxError } from "@/lib/parse-tx-error";
import {
  AnimatedGasAmount,
  GasTankGauge,
  GasTankIcon,
  formatGasAmount,
  gasAmountFromUsdc6,
} from "./GasTankVisuals";

const ZERO = "0x0000000000000000000000000000000000000000";

/** Top-up sizes that cover a useful number of runs without making the user do the arithmetic. */
const QUICK_AMOUNTS = [1, 5, 10, 25];

/**
 * The stages a top-up can be in. Only one is ever active, and it is the truth — the same grammar
 * the create-plan modal speaks, because this is the same kind of multi-signature errand.
 */
type Stage = "switching" | "approving" | "depositing" | "confirming" | "done";

function ChainSelect({
  selectedChainId,
  chainIds,
  byChain,
  onSelect,
  disabled,
}: {
  selectedChainId: number;
  chainIds: number[];
  byChain: Record<number, bigint>;
  onSelect: (chainId: number) => void;
  disabled?: boolean;
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

  const label = CHAIN_NAMES[selectedChainId] ?? `Chain ${selectedChainId}`;

  return (
    <div ref={ref} className="gt-select">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        className="gt-select-btn"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <ChainMark chainId={selectedChainId} />
        <span className="gt-select-name">{label}</span>
        <span className="gt-select-bal">{gasAmountFromUsdc6(byChain[selectedChainId] ?? 0n)}</span>
        <svg className={`gt-select-caret${open ? " is-open" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="gt-select-pop" onMouseDown={(e) => e.stopPropagation()}>
          <ul role="listbox">
            {chainIds.map((cid, i) => (
              <li key={cid} role="option" aria-selected={selectedChainId === cid} style={{ ["--i" as string]: i }}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(cid);
                    setOpen(false);
                  }}
                  className={`gt-select-item${selectedChainId === cid ? " is-selected" : ""}`}
                >
                  <ChainMark chainId={cid} />
                  <span className="gt-select-name">{CHAIN_NAMES[cid] ?? `Chain ${cid}`}</span>
                  <span className="gt-select-bal">{gasAmountFromUsdc6(byChain[cid] ?? 0n)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ChainMark({ chainId, className }: { chainId: number; className?: string }) {
  const icon = CHAIN_ICON_URLS[chainId];
  const name = CHAIN_NAMES[chainId] ?? `Chain ${chainId}`;
  if (!icon) {
    return <span className={`gt-chain-mark gt-chain-mark-fallback ${className ?? ""}`} aria-hidden>{name.slice(0, 1)}</span>;
  }
  return (
    <span className={`gt-chain-mark ${className ?? ""}`} aria-hidden>
      <Image src={icon} alt="" width={20} height={20} />
    </span>
  );
}

/**
 * Where the per-run price comes from, for the network currently selected.
 *
 * The tank is held in USDC, but nothing on chain is paid in USDC: the relayer signs two
 * transactions for every scheduled run — the swap itself, and the recordExecution that debits
 * this tank — and pays for both in the network's own token. The price the tank is charged is
 * those two fees valued at that token's USD price, which is the only reason a run on a chain
 * with sub-cent fees can still cost fifty cents on one whose token trades in the hundreds.
 *
 * Every term is read live (see useRunCostBreakdown): gas price from the chain, token price from
 * /api/native-price, the charge itself from the GasTank contract. All three differ per network,
 * so switching the selector above re-quotes the whole thing rather than restating one chain's
 * numbers. Collapsed by default — the headline price is what most people came for, and the
 * arithmetic behind it should not push the balance and the top-up field off screen.
 */
function RunCostExplainer({
  chainId,
  costPerRunUsdc6,
}: {
  chainId: number;
  costPerRunUsdc6: bigint;
}) {
  const [open, setOpen] = useState(false);
  const symbol = getNativeSymbol(chainId);
  const chainName = CHAIN_NAMES[chainId] ?? `Chain ${chainId}`;
  const { feeNative, nativeUsd, nativeSource, liveUsd, gasPriceGwei, isLoading } =
    useRunCostBreakdown(chainId);

  const chargedUsd = Number(formatUnits(costPerRunUsdc6, 6));
  const charged = formatGasAmount(chargedUsd);

  /**
   * Gas moves; the on-chain rate is only re-set when someone changes it. Saying so beats letting
   * a user find the gap themselves and conclude the number is made up — but only call it out once
   * it is wide enough to notice, or every rounding difference reads as a warning.
   */
  const driftNote = (() => {
    if (liveUsd == null || chargedUsd <= 0) return null;
    const drift = (liveUsd - chargedUsd) / chargedUsd;
    if (Math.abs(drift) < 0.25) return null;
    const live = formatGasAmount(liveUsd);
    return drift > 0
      ? `${symbol} or gas has risen since the rate was set — a run costs the relayer about ${live} USDC today, and you are still charged ${charged}.`
      : `Gas is cheaper than when the rate was set — a run costs the relayer about ${live} USDC today, against the ${charged} charged.`;
  })();

  return (
    <section className={`gt-why${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="gt-why-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="gt-why-panel"
      >
        <span className="gt-why-toggle-label">
          What a run costs
          <span className="gt-why-chain">on {chainName}</span>
        </span>
        <span className="gt-why-price">
          {charged} <small>USDC</small>
        </span>
        <svg className="gt-why-chev" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/*
        gt-why-panel is the element the 0fr grid row collapses, so it carries no padding of its
        own — padding survives a zero-height row and would leave the first line of the breakdown
        peeking out below the toggle. All spacing lives on gt-why-inner instead.
      */}
      <div className="gt-why-wrap" id="gt-why-panel" role="region" aria-label="How the per-run cost is worked out">
        <div className="gt-why-panel">
          <div className="gt-why-inner" inert={!open}>
          <dl className="gt-why-rows">
            <div className="gt-why-row">
              <dt>
                Network fee <span>2 txs · {chainName}</span>
              </dt>
              <dd>
                {feeNative != null ? (
                  <>
                    ≈{formatNativeAmount(feeNative)} {symbol}
                  </>
                ) : (
                  <em>{isLoading ? "reading…" : "unavailable"}</em>
                )}
              </dd>
            </div>
            <div className="gt-why-row">
              <dt>
                {symbol} price{" "}
                <span>
                  {nativeSource === "coingecko"
                    ? "coingecko"
                    : nativeSource === "botdex"
                      ? "bot dex"
                      : nativeSource === "override"
                        ? "set rate"
                        : nativeSource === "static"
                          ? "testnet rate"
                          : "no feed"}
                </span>
              </dt>
              <dd>
                {nativeUsd != null ? formatUsdPrice(nativeUsd) : <em>{isLoading ? "reading…" : "—"}</em>}
              </dd>
            </div>
            <div className="gt-why-row gt-why-row-out">
              <dt>
                Charged to your tank <span>flat rate, set on-chain</span>
              </dt>
              <dd>{charged} USDC</dd>
            </div>
          </dl>

          <p className="gt-why-note">
            Each run is two transactions our relayer signs and pays for in {symbol} — the swap on{" "}
            {chainName}, and the record that debits this tank. Their combined fee at {symbol}&apos;s
            USD price is what the {charged} USDC covers. It is a flat rate, not a meter: a run that
            costs the relayer more never charges you extra.
          </p>

          {driftNote && <p className="gt-why-drift">{driftNote}</p>}

          {gasPriceGwei != null && (
            <p className="gt-why-meta">
              Live gas price {formatNativeAmount(gasPriceGwei)} gwei · ≈
              {Number(GAS_UNITS_PER_RUN).toLocaleString("en-US")} gas burned per run · re-read
              while this stays open.
            </p>
          )}
          </div>
        </div>
      </div>
    </section>
  );
}

interface GasTankTopUpModalProps {
  open: boolean;
  onClose: () => void;
}

export function GasTankTopUpModal({ open, onClose }: GasTankTopUpModalProps) {
  const { address, isConnected, chainId: walletChainId } = useAccount();
  const chainsWithGasTank = useMemo(() => getChainsWithGasTank(), []);
  const { totalBalanceUsdc6, byChain } = useGasTankAllChains();
  const refreshGasTank = useGasTankRefresh();

  const [selectedChainId, setSelectedChainId] = useState<number>(chainsWithGasTank[0] ?? 84532);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage | null>(null);
  /** Which steps this particular top-up needs. Set at submit, so the rail never invents one. */
  const [flow, setFlow] = useState<{ switchNetwork: boolean; approve: boolean }>({
    switchNetwork: false,
    approve: false,
  });
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);
  /** What the finished top-up added, kept for the success card after the input is cleared. */
  const [addedUsdc6, setAddedUsdc6] = useState<bigint>(0n);
  /** The network row to highlight once its balance has just grown. */
  const [freshChainId, setFreshChainId] = useState<number | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const contractsForChain = getContracts(selectedChainId);
  const gasTankAddr = contractsForChain?.GasTank;
  const usdcAddr = contractsForChain?.MockUSDC;
  const hasGasTank = Boolean(gasTankAddr && gasTankAddr !== ZERO && usdcAddr && usdcAddr !== ZERO);

  const publicClient = usePublicClient({ chainId: selectedChainId });
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const { data: usdcBalance } = useBalance({
    address: address ?? undefined,
    token: usdcAddr as `0x${string}`,
    chainId: selectedChainId,
    query: { enabled: Boolean(address && hasGasTank) },
  });

  /** Allowance on the network being topped up, not the one the wallet happens to sit on. */
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: usdcAddr as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [address as `0x${string}`, gasTankAddr as `0x${string}`],
    chainId: selectedChainId,
    query: { enabled: Boolean(address && hasGasTank) },
  });

  const { runsLeft, level, isEmpty, isLow, costPerRunUsdc6 } = useGasTankLevel(
    totalBalanceUsdc6,
    selectedChainId,
  );

  const amountWei = (() => {
    const trimmed = amount.trim();
    if (!trimmed) return 0n;
    try {
      return parseUnits(trimmed, 6);
    } catch {
      return 0n;
    }
  })();
  const walletUsdc = usdcBalance?.value ?? 0n;
  const needsApproval = (allowance ?? 0n) < amountWei;
  const needsSwitch = walletChainId !== selectedChainId;
  const overBalance = amountWei > 0n && amountWei > walletUsdc;
  const runsBought = costPerRunUsdc6 > 0n ? Number(amountWei / costPerRunUsdc6) : 0;
  const isBusy = stage !== null && stage !== "done";
  const canSubmit = isConnected && hasGasTank && amountWei > 0n && !overBalance && !isBusy;

  const tone: "ok" | "low" | "empty" = isEmpty ? "empty" : isLow ? "low" : "ok";

  /** Funded networks first — the ones with nothing in them are noise until they are picked. */
  const breakdown = chainsWithGasTank
    .map((cid) => ({ chainId: cid, amount: byChain[cid] ?? 0n }))
    .sort((a, b) => (b.amount > a.amount ? 1 : b.amount < a.amount ? -1 : 0));
  const maxShare = breakdown[0]?.amount ?? 0n;

  useEffect(() => {
    if (!open) return;
    // Escape must not unmount us mid-transaction: the flow that waits for receipts lives here.
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isBusy) onClose();
    };
    document.addEventListener("keydown", onEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onEscape);
      document.body.style.overflow = "";
    };
  }, [open, onClose, isBusy]);

  /**
   * Open on the network the wallet is already on, when it has a tank. Defaulting to the first
   * deployed chain made an unnecessary network switch the common case.
   */
  const pickedOnOpen = useRef(false);
  useEffect(() => {
    if (!open) {
      pickedOnOpen.current = false;
      return;
    }
    if (pickedOnOpen.current || chainsWithGasTank.length === 0) return;
    pickedOnOpen.current = true;
    const preferred =
      walletChainId && chainsWithGasTank.includes(walletChainId)
        ? walletChainId
        : chainsWithGasTank[0];
    if (preferred !== selectedChainId) setSelectedChainId(preferred);
  }, [open, walletChainId, chainsWithGasTank, selectedChainId]);

  // A fresh open starts from a clean slate — a stale error or a finished rail is not this run's.
  useEffect(() => {
    if (open) return;
    setStage(null);
    setError(null);
    setTxHash(undefined);
    setAmount("");
    setAddedUsdc6(0n);
    setFreshChainId(null);
  }, [open]);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (isBusy) return;
    if (contentRef.current && !contentRef.current.contains(e.target as Node)) onClose();
  };

  /**
   * Approve and deposit as one errand.
   *
   * These used to be two buttons the user had to find in sequence, with the second only appearing
   * once the first confirmed — so a top-up looked finished when the money had not moved. Now the
   * whole thing runs from one press, and every signature the wallet asks for is a step on the rail.
   */
  const handleTopUp = async () => {
    if (!address || !hasGasTank || amountWei <= 0n) return;
    if (!publicClient) {
      setError("No RPC connection for this network — try again in a moment.");
      return;
    }

    setError(null);
    const willSwitch = needsSwitch;
    const willApprove = needsApproval;
    setFlow({ switchNetwork: willSwitch, approve: willApprove });

    try {
      if (willSwitch) {
        setStage("switching");
        await switchChainAsync({ chainId: selectedChainId });
      }

      if (willApprove) {
        setStage("approving");
        const approveHash = await writeContractAsync({
          address: usdcAddr as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [gasTankAddr as `0x${string}`, amountWei],
          chainId: selectedChainId,
        });
        const approveReceipt = await publicClient.waitForTransactionReceipt({ hash: approveHash });
        if (approveReceipt.status !== "success") {
          throw new Error("The approval transaction reverted on-chain.");
        }
        await refetchAllowance();
      }

      setStage("depositing");
      const depositHash = await writeContractAsync({
        address: gasTankAddr as `0x${string}`,
        abi: GAS_TANK_ABI,
        functionName: "deposit",
        args: [amountWei],
        chainId: selectedChainId,
      });
      setTxHash(depositHash);

      setStage("confirming");
      const receipt = await publicClient.waitForTransactionReceipt({ hash: depositHash });
      if (receipt.status !== "success") {
        throw new Error("The deposit transaction reverted on-chain.");
      }

      // Only now is the balance real. Refresh every surface before saying so.
      const deposited = amountWei;
      setAddedUsdc6(deposited);
      setFreshChainId(selectedChainId);
      setAmount("");
      await refreshGasTank();
      setStage("done");
      toast.success(`${gasAmountFromUsdc6(deposited)} USDC added to your gas tank.`);

      window.setTimeout(() => {
        setStage(null);
        setTxHash(undefined);
      }, 2200);
    } catch (err) {
      setError(parseTxError(err, "Top up failed"));
      setStage(null);
      setTxHash(undefined);
    }
  };

  if (!open) return null;

  /** The steps this top-up will take, in order, built from the flow captured at submit. */
  const steps: { id: Stage; label: string; note: string }[] = [
    ...(flow.switchNetwork
      ? [
          {
            id: "switching" as const,
            label: `Switch to ${CHAIN_NAMES[selectedChainId] ?? selectedChainId}`,
            note: "Your wallet needs to be on the network you are funding.",
          },
        ]
      : []),
    ...(flow.approve
      ? [
          {
            id: "approving" as const,
            label: "Approve USDC",
            note: "Lets the gas tank pull exactly this amount — nothing more.",
          },
        ]
      : []),
    {
      id: "depositing" as const,
      label: "Confirm the deposit",
      note: "Signs the transfer into your tank.",
    },
    {
      id: "confirming" as const,
      label: "Confirming on-chain",
      note: `Waiting for ${CHAIN_NAMES[selectedChainId] ?? "the network"} to include it.`,
    },
  ];
  const stageIndex = stage === "done" ? steps.length : steps.findIndex((s) => s.id === stage);

  const buttonLabel = !isConnected
    ? "Connect your wallet"
    : amountWei <= 0n
      ? "Enter an amount"
      : overBalance
        ? "Not enough USDC"
        : needsSwitch
          ? `Switch, approve & deposit`
          : needsApproval
            ? "Approve & deposit"
            : `Deposit ${formatGasAmount(Number(formatUnits(amountWei, 6)))} USDC`;

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="gas-tank-modal-title"
        className="dm-overlay"
        onClick={handleOverlayClick}
      >
        <div className="dm-veil" aria-hidden>
          <span className="dm-veil-bloom dm-veil-bloom-a" />
          <span className="dm-veil-bloom dm-veil-bloom-b" />
        </div>

        <div ref={contentRef} className="gt-shell" onClick={(e) => e.stopPropagation()}>
          <span className="dm-edge" aria-hidden />

          {/* Header */}
          <div className="gt-head">
            <span className="gt-head-grid" aria-hidden />
            <span className="gt-head-sheen" aria-hidden />
            <span className="gt-head-mark" aria-hidden>
              <GasTankIcon />
            </span>
            <div className="gt-head-copy">
              <h2 id="gas-tank-modal-title" className="gt-title">
                Gas tank
              </h2>
              <p className="gt-sub">One balance, spendable on any network</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isBusy}
              className="gt-close"
              aria-label="Close"
            >
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="gt-body">
            {/* ---------- What is in the tank ---------- */}
            {isConnected && (
              <section className={`gt-hero gt-hero-${tone}`}>
                <span className="gt-hero-mesh" aria-hidden />
                <GasTankGauge
                  level={level}
                  tone={tone}
                  size={104}
                  label={isEmpty ? "0" : runsLeft > 999 ? "999+" : String(runsLeft)}
                  sublabel="runs"
                  pulse={isEmpty}
                />
                <div className="gt-hero-copy">
                  <p className="gt-hero-label">Total balance</p>
                  <p className="gt-hero-value">
                    <AnimatedGasAmount valueUsdc6={totalBalanceUsdc6} />
                    <small>USDC</small>
                  </p>
                  <p className="gt-hero-note">
                    {isEmpty
                      ? "Empty — auto-execution needs gas to run your plans."
                      : isLow
                        ? `Running low: about ${runsLeft} run${runsLeft === 1 ? "" : "s"} left. Top up before it stops.`
                        : `Enough for about ${runsLeft > 999 ? "999+" : runsLeft} more scheduled run${runsLeft === 1 ? "" : "s"}.`}
                  </p>
                </div>
                {(isEmpty || isLow) && (
                  <span className={`gt-flag gt-flag-${tone}`}>
                    <svg fill="none" stroke="currentColor" strokeWidth="2.1" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.3 3.9L2 18a2 2 0 001.7 3h16.6a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
                    </svg>
                    {isEmpty ? "Empty" : "Low"}
                  </span>
                )}
              </section>
            )}

            {/* ---------- Why a run costs what it costs ---------- */}
            <RunCostExplainer chainId={selectedChainId} costPerRunUsdc6={costPerRunUsdc6} />

            {/* ---------- Where it is held ---------- */}
            {breakdown.length > 0 && (
              <section className="gt-nets">
                <div className="gt-nets-head">
                  <p className="gt-section-label">By network</p>
                  <span className="gt-nets-hint">held per network · spent as one</span>
                </div>
                <ul className="gt-nets-list">
                  {breakdown.map((c, i) => {
                    const width =
                      maxShare > 0n && c.amount > 0n
                        ? Math.max(6, Number((c.amount * 100n) / maxShare))
                        : 0;
                    return (
                      <li
                        key={c.chainId}
                        className={`gt-net${freshChainId === c.chainId ? " is-fresh" : ""}${c.amount === 0n ? " is-empty" : ""}`}
                        style={{ ["--i" as string]: i }}
                      >
                        <ChainMark chainId={c.chainId} className="gt-net-mark" />
                        <span className="gt-net-name">{CHAIN_NAMES[c.chainId] ?? `Chain ${c.chainId}`}</span>
                        <span className="gt-net-bar" aria-hidden>
                          <span className="gt-net-fill" style={{ ["--w" as string]: `${width}%` }} />
                        </span>
                        <span className="gt-net-amt">{gasAmountFromUsdc6(c.amount)}</span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {/* ---------- Top up ---------- */}
            <section className="gt-topup">
              <p className="gt-section-label">Top up</p>

              <ChainSelect
                selectedChainId={selectedChainId}
                chainIds={chainsWithGasTank}
                byChain={byChain}
                onSelect={(cid) => {
                  setSelectedChainId(cid);
                  setError(null);
                }}
                disabled={isBusy}
              />

              {!hasGasTank ? (
                <p className="gt-hint gt-hint-warn">
                  No gas tank is deployed on this network yet — pick another one.
                </p>
              ) : (
                <>
                  <div className="gt-amount">
                    <span className="gt-amount-prefix" aria-hidden>$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={amount}
                      disabled={isBusy}
                      onChange={(e) => {
                        setAmount(e.target.value);
                        setError(null);
                      }}
                      className="gt-amount-input"
                      aria-label="Amount of USDC to deposit"
                    />
                    <button
                      type="button"
                      className="gt-max"
                      disabled={isBusy || walletUsdc === 0n}
                      onClick={() => setAmount(formatUnits(walletUsdc, 6))}
                    >
                      Max
                    </button>
                  </div>

                  <div className="gt-quick">
                    {QUICK_AMOUNTS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        disabled={isBusy}
                        onClick={() => {
                          setAmount(String(preset));
                          setError(null);
                        }}
                        aria-pressed={amount === String(preset)}
                        className="gt-quick-btn"
                      >
                        ${preset}
                      </button>
                    ))}
                    <span className="gt-quick-note">
                      {usdcBalance ? `${gasAmountFromUsdc6(walletUsdc)} USDC in wallet` : " "}
                    </span>
                  </div>

                  {amountWei > 0n && !overBalance && (
                    <p className="gt-hint gt-hint-good">
                      <svg fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Buys about <b>{runsBought > 9999 ? "9,999+" : runsBought.toLocaleString("en-US")}</b> scheduled runs
                      {" "}({formatGasAmount(Number(formatUnits(costPerRunUsdc6, 6)))} USDC each).
                    </p>
                  )}
                  {overBalance && (
                    <p className="gt-hint gt-hint-warn">
                      That is more than the {gasAmountFromUsdc6(walletUsdc)} USDC you hold on{" "}
                      {CHAIN_NAMES[selectedChainId] ?? "this network"}.
                    </p>
                  )}
                </>
              )}
            </section>
          </div>

          {/* Footer */}
          <div className="gt-foot">
            <p className="gt-foot-hint">
              {needsApproval && amountWei > 0n
                ? "Approval and deposit run back to back — your wallet will ask twice."
                : "Gas is deducted per run, on whichever network has a balance."}
            </p>
            <button type="button" onClick={onClose} disabled={isBusy} className="ss-btn ss-btn-soft">
              Close
            </button>
            <button
              type="button"
              onClick={() => void handleTopUp()}
              disabled={!canSubmit}
              data-loading={isBusy ? "true" : undefined}
              className="ss-btn ss-btn-primary ss-btn-glow"
            >
              {isBusy ? "Working…" : buttonLabel}
            </button>
          </div>
        </div>
      </div>

      {/* Progress — one step is active, and it is the one really happening */}
      {stage && (
        <div className="dm-prog" role="dialog" aria-modal="true" aria-label="Topping up gas tank">
          <div className="dm-veil" aria-hidden />

          <div className="dm-prog-card">
            <span className="dm-prog-aura" aria-hidden />

            {stage === "done" ? (
              <div className="gt-done">
                <span className="gt-done-mark" aria-hidden>
                  <svg fill="none" stroke="currentColor" strokeWidth="2.6" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="gt-done-ring" />
                  <span className="gt-done-ring gt-done-ring-b" />
                </span>
                <p className="gt-done-title">Tank topped up</p>
                <p className="gt-done-amount">
                  +{gasAmountFromUsdc6(addedUsdc6)} <small>USDC</small>
                </p>
                <p className="gt-done-sub">
                  New balance <b>{gasAmountFromUsdc6(totalBalanceUsdc6)} USDC</b> — updated everywhere.
                </p>
              </div>
            ) : (
              <>
                <div className="dm-prog-head">
                  <span className="dm-prog-orb" aria-hidden>
                    <GasTankIcon />
                  </span>
                  <div className="min-w-0">
                    <p className="dm-prog-title">Topping up your tank…</p>
                    <p className="dm-prog-sub">Keep this window open until every step is done.</p>
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

                {txHash && (
                  <div className="dm-prog-tx">
                    <p className="dm-prog-tx-label">Transaction</p>
                    <p className="dm-prog-tx-hash">{txHash}</p>
                  </div>
                )}

                <p className="dm-prog-foot">
                  Your wallet may ask you to confirm more than once — that&apos;s each step above.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
