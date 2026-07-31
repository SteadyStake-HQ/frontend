"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { toast } from "react-toastify";
import {
  useAccount,
  useBalance,
  useChainId,
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
import { getContracts, getStableDecimals, getStableSymbol } from "@/config/contracts";
import { SUPPORTED_CHAIN_IDS } from "@/config/chains-env";
import {
  useRunCostBreakdown,
  formatNativeAmount,
  formatUsdPrice,
} from "@/app/hooks/useRunCost";
import { CHAIN_ICON_URLS, getNativeSymbol } from "@/config/wagmi";
import { CHAIN_NAMES } from "@/lib/constants";
import { useNetworkAllocation } from "@/app/hooks/useNetworkAllocation";
import { formatUnits, parseUnits } from "viem";
import { parseTxError } from "@/lib/parse-tx-error";
import {
  AnimatedGasAmount,
  GasTankGauge,
  GasTankIcon,
  POOLED_SYMBOL,
  formatGasAmount,
  formatRunCostUsd,
  gasAmountForChain,
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

/**
 * The network this modal is talking about.
 *
 * It lists every network the build supports, not only the ones with a GasTank deployed. The
 * selector used to be filtered to fundable chains, which on a mainnet build meant BOT Chain alone
 * — so the whole modal, breakdown included, could only ever describe one network however many the
 * app actually ran plans on. A chain without a tank is still worth quoting (its gas, its token,
 * its per-run cost are all real), so it stays selectable and is marked rather than hidden; the
 * top-up section is what refuses, and it says why.
 */
function ChainSelect({
  selectedChainId,
  chainIds,
  tankChainIds,
  byChain,
  onSelect,
  disabled,
}: {
  selectedChainId: number;
  chainIds: number[];
  tankChainIds: number[];
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
  const hasTank = (cid: number) => tankChainIds.includes(cid);

  /** A balance only means something where a tank exists; elsewhere say so instead of showing 0.00. */
  const trailing = (cid: number) =>
    hasTank(cid) ? (
      <span className="gt-select-bal">{gasAmountForChain(byChain[cid] ?? 0n, cid)}</span>
    ) : (
      <span className="gt-select-tag">no tank yet</span>
    );

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
        {trailing(selectedChainId)}
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
                  className={`gt-select-item${selectedChainId === cid ? " is-selected" : ""}${hasTank(cid) ? "" : " is-tankless"}`}
                >
                  <ChainMark chainId={cid} />
                  <span className="gt-select-name">{CHAIN_NAMES[cid] ?? `Chain ${cid}`}</span>
                  {trailing(cid)}
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
 * The premium for paying a run out of another network's tank, drawn rather than described.
 *
 * Two bars on a shared scale: what a run on this network has cost when its own tank paid, and what
 * it has cost when another network's did. The gap is the whole point and the eye reads it without
 * being told the number twice. Where the relayer has not settled runs both ways here there is
 * nothing to compare, so the rule itself is stated in one line instead.
 */
function CrossChainPremium({
  chainName,
  unit,
  sameChainAvgUsd,
  crossChainAvgUsd,
}: {
  chainName: string;
  unit: string;
  sameChainAvgUsd: number | null;
  crossChainAvgUsd: number | null;
}) {
  const measured = sameChainAvgUsd != null && crossChainAvgUsd != null;
  const peak = measured ? Math.max(sameChainAvgUsd, crossChainAvgUsd) : 0;
  /** A bar never disappears: below a few percent it stops reading as a quantity at all. */
  const width = (value: number) => `${Math.max(8, peak > 0 ? (value / peak) * 100 : 0)}%`;

  return (
    <div className="gt-cross">
      <p className="gt-cross-head">
        <span className="gt-why-live-dot" aria-hidden />
        Paying from another network costs more
      </p>

      {measured ? (
        <div className="gt-cross-bars">
          <div className="gt-cross-row">
            <span className="gt-cross-label">from {chainName}</span>
            <span className="gt-cross-track" aria-hidden>
              <i className="gt-cross-fill is-same" style={{ ["--w" as string]: width(sameChainAvgUsd) }} />
            </span>
            <b>{formatRunCostUsd(sameChainAvgUsd)}</b>
          </div>
          <div className="gt-cross-row">
            <span className="gt-cross-label">from elsewhere</span>
            <span className="gt-cross-track" aria-hidden>
              <i className="gt-cross-fill is-cross" style={{ ["--w" as string]: width(crossChainAvgUsd) }} />
            </span>
            <b>{formatRunCostUsd(crossChainAvgUsd)}</b>
          </div>
          <p className="gt-cross-foot">
            average {unit} per run on {chainName} · the debit runs on the paying network
          </p>
        </div>
      ) : (
        <p className="gt-cross-foot">
          The debit runs on the paying network, at its gas price — a balance on {chainName} is the
          cheapest way to run plans there.
        </p>
      )}
    </div>
  );
}

/**
 * What a run costs on the network the wallet is on, and what recent ones actually cost.
 *
 * The tank is held in a stablecoin, but nothing on chain is paid in it: the relayer signs two
 * transactions for every scheduled run — the swap itself, and the recordExecution that debits
 * this tank — and pays for both in the network's own token. What the tank is charged is those two
 * fees valued at that token's USD price, which is the only reason a run on a chain with sub-cent
 * fees can still cost fifty cents on one whose token trades in the hundreds.
 *
 * Nobody sets that figure. The relayer debits what the run burned, so the headline here is an
 * estimate of the next run rather than a rate — every term of it is read live (see
 * useRunCostBreakdown): gas price from the chain, token price from /api/native-price, gas units
 * from the receipts of real runs. Collapsed by default; the headline is what most people came for.
 *
 * Because that figure moves, the section also publishes what the last runs on this network were
 * really charged — the average and the most expensive of them. An estimate alone invites a user to
 * treat it as a fixed price and then read the next one as a bug; the range is what makes a
 * variable charge something a person can plan around.
 *
 * Those two sit *outside* the disclosure, not in it. The average is not a footnote to the estimate
 * — it is the number the tank's runs-left count is worked out at (useEstimatedRunCostUsdc6 prefers
 * the measured average over the live estimate), so leaving it behind a tap meant the headline
 * figure of the whole modal, "36 runs", had no visible arithmetic. The maximum rides with it
 * because the two answer different questions and a user sizing a top-up needs the second.
 *
 * The network is the one the wallet is connected to — whatever RainbowKit's switcher is showing —
 * and not the one picked in the top-up section below. Those are two different questions. The
 * selector answers "which tank am I putting money into"; this answers "what does a run cost on the
 * network I am on", which is a real question about Base or Polygon whether or not either can be
 * funded yet.
 *
 * Where nothing can be read — an RPC we cannot reach, a token no feed prices — the whole section
 * hides. A breakdown with every row blank teaches a user nothing, and one that keeps the last
 * chain's numbers actively misleads them.
 */
function RunCostExplainer({ chainId }: { chainId: number }) {
  const [open, setOpen] = useState(false);
  const symbol = getNativeSymbol(chainId);
  const stable = getStableSymbol(chainId);
  const chainName = CHAIN_NAMES[chainId] ?? `Chain ${chainId}`;
  /**
   * Whether a run on this network charges anything at all. Only the tank's own address decides
   * that — the settlement stablecoin matters for making a deposit, not for whether a debit exists.
   */
  const gasTankAddr = getContracts(chainId)?.GasTank;
  const hasGasTank = Boolean(gasTankAddr && gasTankAddr !== ZERO);
  const {
    feeNative,
    nativeUsd,
    nativeSource,
    liveUsd,
    cost,
    isLoading,
  } = useRunCostBreakdown(chainId);

  /**
   * The headline: what the next run on this network will cost, at this minute's gas price and
   * token price.
   *
   * Where those cannot be read — an RPC we cannot reach, a token no feed prices — it falls back to
   * the average of what runs here have really been charged. That is a different claim and is
   * labelled as one, but it is a true and useful number, and the section used to unmount itself
   * entirely rather than show it: a network with a thousand runs on record would go blank because
   * one price feed was briefly unavailable.
   */
  const isEstimate = liveUsd != null;
  const headlineUsd = liveUsd ?? cost.avgUsd;
  const headline = headlineUsd != null ? formatRunCostUsd(headlineUsd) : null;
  /**
   * A charge is denominated in the token the tank holds; an estimate for a network with no tank is
   * not denominated in anything. Quoting the latter in USDC would imply a tank exists to hold it.
   */
  const headlineUnit = hasGasTank ? stable : POOLED_SYMBOL;
  const headlineFrom = !isEstimate
    ? `measured · ${cost.samples.toLocaleString("en-US")} run${cost.samples === 1 ? "" : "s"} on record`
    : hasGasTank
      ? "charged as spent · estimate"
      : `estimated live · no tank on ${chainName} yet`;

  /**
   * The record the range below is drawn from: every execution ever saved on this network, for
   * every user. It used to be the last thousand the running relayer process happened to have
   * watched, which after any redeploy was none of them.
   */
  const runsLabel = `${cost.samples.toLocaleString("en-US")} run${cost.samples === 1 ? "" : "s"} on record`;
  /** The same said as a phrase, for the tips — "all the 1 runs" does not read as English. */
  const windowLabel =
    cost.samples === 1
      ? "the one run on record"
      : `all ${cost.samples.toLocaleString("en-US")} runs on record`;

  if (headline == null) {
    /*
     * Still reading. The chain's gas price and its token's USD price arrive over the network, and
     * unmounting the section for that half-second only to bring it back is a jump the user has to
     * re-read; holding the row and saying what it is waiting for is quieter.
     */
    if (isLoading) {
      return (
        <section className="gt-why">
          <div className="gt-why-toggle" role="status">
            <span className="gt-why-toggle-label">
              What a run costs
              <span className="gt-why-chain">on {chainName}</span>
            </span>
            <span className="gt-why-price">
              <em>reading…</em>
            </span>
          </div>
        </section>
      );
    }
    // Nothing charges a run here, nothing has ever run here, and nothing will quote one either.
    // Say nothing rather than showing a breakdown of blanks under this network's name.
    return null;
  }

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
          {/*
            The panel is collapsed by default, so anything that only appears once it is open will
            be missed by most people. This figure moves — it is gas priced this minute, not a rate
            — and has to say so where the figure is, not only inside the panel. When the live
            inputs cannot be read the headline is the measured average instead, and the tag has to
            change with it rather than label a record as an estimate.
          */}
          <span className="gt-why-tag">
            <span className="gt-why-tag-dot" aria-hidden />
            {isEstimate ? "live estimate" : "measured average"}
          </span>
        </span>
        <span className="gt-why-price">
          {headline} <small>{headlineUnit}</small>
        </span>
        <svg className="gt-why-chev" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/*
        What runs here have really cost, always on screen. The estimate above is about the next
        run; these two are the record, and the average is the one the runs-left gauge divides by —
        so each says what it is *for* rather than leaving the reader to infer it. Two short cells
        and a tag apiece; the sentence-length version of the same point lives on the hover tip.
      */}
      {/*
        Gated on the sample count rather than on both figures being non-null. One charged run gives
        an average and a maximum that are the same number, and showing them is right: "one run, it
        cost this" is a fact, and the block used to vanish whenever either half was missing.
      */}
      {cost.samples > 0 && cost.avgUsd != null && (
        <div className="gt-why-range">
          <span
            className="gt-why-stat is-avg"
            title={`The mean of ${windowLabel} on ${chainName} — every plan on the network, not just yours. Your runs-left count is your tank balance divided by this.`}
          >
            <em>Average run</em>
            <b>
              {formatRunCostUsd(cost.avgUsd)} <small>{headlineUnit}</small>
            </b>
            <span className="gt-why-stat-tag">runs left counts at this</span>
          </span>
          <span
            className="gt-why-stat"
            title={`The dearest of ${windowLabel} on ${chainName}. Size a plan's prepay on this, not on the average — a busy day is what stalls a plan.`}
          >
            <em>Most expensive</em>
            <b>
              {formatRunCostUsd(cost.maxUsd ?? cost.avgUsd)} <small>{headlineUnit}</small>
            </b>
            <span className="gt-why-stat-tag">size a prepay on this</span>
          </span>
          <span className="gt-why-range-note">
            {runsLabel} · {chainName} · all plans
          </span>
        </div>
      )}

      {/*
        gt-why-panel is the element the 0fr grid row collapses, so it carries no padding of its
        own — padding survives a zero-height row and would leave the first line of the breakdown
        peeking out below the toggle. All spacing lives on gt-why-inner instead.
      */}
      <div className="gt-why-wrap" id="gt-why-panel" role="region" aria-label="How the per-run cost is worked out">
        <div className="gt-why-panel">
          <div className="gt-why-inner" inert={!open}>
          <dl className="gt-why-rows">
            {/*
              The native side of the estimate, and the figure the row below is the dollar value
              of — so the two multiply out on screen. It carries the deduction leg's headroom
              because the charge does: the relayer reads the swap's cost off its receipt but has
              to price the deduction before sending it, and bills that half a little wide so it is
              never the one out of pocket. The tip says so rather than a line of prose.
            */}
            <div className="gt-why-row">
              <dt
                title={`Gas for both transactions of a run at ${chainName}'s current gas price. The deduction leg is priced ahead of itself, with headroom, because the amount it debits has to be chosen before it is sent.`}
              >
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
                {hasGasTank ? "Charged to your tank" : `Cost of a run on ${chainName}`}{" "}
                <span>{headlineFrom}</span>
              </dt>
              <dd>{headline} {headlineUnit}</dd>
            </div>
            {/*
              The average and the maximum used to close the list here. They now live above the
              disclosure, where the runs-left count they explain can be seen at the same time.
            */}
          </dl>

          {/*
            The one thing about this charge a user cannot work out from the rows above.
            Balances are pooled, so a run on this network can be settled from another network's
            tank — and when it is, the deduction transaction runs over there, at that chain's gas
            price. The run costs a little more, through no decision of ours.

            This used to be a paragraph saying so. It is now two bars, because the claim is a
            comparison and a comparison is a thing to see: where the relayer has actually settled
            runs both ways on this network the measured premium is drawn to scale, and where it has
            not, one short line stands in. Either way it reads in a glance instead of a sentence.
          */}
          <CrossChainPremium
            chainName={chainName}
            unit={headlineUnit}
            sameChainAvgUsd={cost.sameChainAvgUsd}
            crossChainAvgUsd={cost.crossChainAvgUsd}
          />
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
  /**
   * The network RainbowKit is showing. `walletChainId` is undefined until a wallet connects, and
   * the run-cost section still has something true to say before that — useChainId falls back to
   * the first configured chain, which is what the rest of the app reads too (useContracts).
   */
  const activeChainId = useChainId();
  const allocation = useNetworkAllocation();
  /**
   * Fundable *and* in service. A paused network is closed to every feature, funding its tank
   * included, so it is not offered here even from a network that is live.
   */
  const chainsWithGasTank = useMemo(
    () => getChainsWithGasTank().filter((cid) => allocation.acceptsNewPlans(cid)),
    [allocation],
  );
  /**
   * Every network the build supports and the operator has in service, fundable ones first. The
   * selector offers all of them so the breakdown can quote any network the app runs plans on;
   * ordering keeps the ones you can actually top up at the top of the list rather than scattered
   * through it.
   */
  const selectableChains = useMemo(
    () => [
      ...chainsWithGasTank,
      ...SUPPORTED_CHAIN_IDS.filter(
        (cid) => !chainsWithGasTank.includes(cid) && allocation.acceptsNewPlans(cid),
      ),
    ],
    [chainsWithGasTank, allocation],
  );
  /**
   * `allByChain` for the per-network rows and the selector, `totalBalanceUsdc6` for the headline.
   * They answer different questions: every tank holds the user's money and must be shown and
   * topped up, but only the tanks of the connected network's kind can pay for a run on it, and the
   * headline is what the plan screens spend against.
   */
  const { totalBalanceUsdc6, allByChain } = useGasTankAllChains();
  const refreshGasTank = useGasTankRefresh();

  const [selectedChainId, setSelectedChainId] = useState<number>(
    chainsWithGasTank[0] ?? selectableChains[0] ?? SUPPORTED_CHAIN_IDS[0] ?? 84532,
  );
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage | null>(null);
  /** A switch asked for from the banner rather than as the first step of a top-up. */
  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false);
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
  /** Label for the tank's stablecoin on the network being topped up — USDT on BOT Chain. */
  const stable = getStableSymbol(selectedChainId);
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
      return parseUnits(trimmed, getStableDecimals(selectedChainId));
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
    .map((cid) => ({ chainId: cid, amount: allByChain[cid] ?? 0n }))
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
    setIsSwitchingNetwork(false);
  }, [open]);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (isBusy) return;
    if (contentRef.current && !contentRef.current.contains(e.target as Node)) onClose();
  };

  /**
   * Move the wallet to the network being funded, on its own.
   *
   * A deposit lands on whichever chain the wallet signs it on, so funding BOT Chain from a wallet
   * sitting on Base has always meant a switch. handleTopUp still does it as the first step, but
   * doing it only there made the switch a surprise inside a multi-signature flow — the wallet would
   * pop a network prompt when the user thought they were confirming a transfer. Asking up front,
   * in the section that names the network, makes the switch the deliberate act it is.
   */
  const handleSwitchNetwork = async () => {
    if (isSwitchingNetwork) return;
    setIsSwitchingNetwork(true);
    try {
      await switchChainAsync({ chainId: selectedChainId });
      setError(null);
    } catch (err) {
      setError(parseTxError(err, "Could not switch network"));
    } finally {
      setIsSwitchingNetwork(false);
    }
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
      toast.success(`${gasAmountForChain(deposited, selectedChainId)} ${stable} added to your gas tank.`);

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
            note: "Your wallet has to be on the network you are funding.",
          },
        ]
      : []),
    ...(flow.approve
      ? [
          {
            id: "approving" as const,
            label: `Approve ${stable}`,
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
        ? `Not enough ${stable}`
        : needsSwitch
          ? `Switch, approve & deposit`
          : needsApproval
            ? "Approve & deposit"
            : `Deposit ${formatGasAmount(Number(formatUnits(amountWei, getStableDecimals(selectedChainId))))} ${stable}`;

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
                    <small>{POOLED_SYMBOL}</small>
                  </p>
                  <p className="gt-hero-note">
                    {isEmpty
                      ? "Empty — plans cannot auto-execute."
                      : isLow
                        ? `About ${runsLeft} run${runsLeft === 1 ? "" : "s"} left — top up soon.`
                        : `About ${runsLeft > 999 ? "999+" : runsLeft} more scheduled run${runsLeft === 1 ? "" : "s"}.`}
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

            {/* ---------- Why a run costs what it costs, on the network the wallet is on ---------- */}
            <RunCostExplainer chainId={activeChainId} />

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
                        <span className="gt-net-amt">{gasAmountForChain(c.amount, c.chainId)}</span>
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
                chainIds={selectableChains}
                tankChainIds={chainsWithGasTank}
                byChain={allByChain}
                onSelect={(cid) => {
                  setSelectedChainId(cid);
                  setError(null);
                }}
                disabled={isBusy}
              />

              {!hasGasTank ? (
                <p className="gt-hint gt-hint-warn">
                  No tank on {CHAIN_NAMES[selectedChainId] ?? "this network"} yet — pick one that
                  has a tank to top up.
                </p>
              ) : (
                <>
                  {/*
                    The deposit is signed on whatever chain the wallet is on, so a mismatch has to be
                    resolved before the money moves. handleTopUp switches too, but only after the
                    user has committed — this asks while the network is still the thing on screen.
                  */}
                  {isConnected && needsSwitch && (
                    <div className="gt-switch">
                      <svg fill="none" stroke="currentColor" strokeWidth="2.1" viewBox="0 0 24 24" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h13m0 0l-3-3m3 3l-3 3M20 17H7m0 0l3 3m-3-3l3-3" />
                      </svg>
                      {/* The two networks and an arrow say it; the sentence that used to spell out
                          why a deposit lands where it signs was the same fact twice. */}
                      <p className="gt-switch-copy">
                        <b>{walletChainId ? CHAIN_NAMES[walletChainId] ?? `Chain ${walletChainId}` : "another network"}</b>
                        {" → "}
                        <b>{CHAIN_NAMES[selectedChainId] ?? `Chain ${selectedChainId}`}</b>
                        <span>a top-up lands where your wallet signs it</span>
                      </p>
                      <button
                        type="button"
                        className="gt-switch-btn"
                        onClick={() => void handleSwitchNetwork()}
                        disabled={isBusy || isSwitchingNetwork}
                      >
                        {isSwitchingNetwork
                          ? "Switching…"
                          : `Switch to ${CHAIN_NAMES[selectedChainId] ?? "it"}`}
                      </button>
                    </div>
                  )}

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
                      aria-label={`Amount of ${stable} to deposit`}
                    />
                    <button
                      type="button"
                      className="gt-max"
                      disabled={isBusy || walletUsdc === 0n}
                      onClick={() => setAmount(formatUnits(walletUsdc, getStableDecimals(selectedChainId)))}
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
                      {usdcBalance ? `${gasAmountForChain(walletUsdc, selectedChainId)} ${stable} in wallet` : " "}
                    </span>
                  </div>

                  {amountWei > 0n && !overBalance && (
                    <p className="gt-hint gt-hint-good">
                      <svg fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Buys about <b>{runsBought > 9999 ? "9,999+" : runsBought.toLocaleString("en-US")}</b> scheduled runs
                      {" "}({formatRunCostUsd(Number(formatUnits(costPerRunUsdc6, getStableDecimals(selectedChainId))))} {stable} each).
                    </p>
                  )}
                  {overBalance && (
                    <p className="gt-hint gt-hint-warn">
                      That is more than the {gasAmountForChain(walletUsdc, selectedChainId)} {stable} you hold on{" "}
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
              {isConnected && hasGasTank && needsSwitch
                ? `Switches to ${CHAIN_NAMES[selectedChainId] ?? "that network"} first.`
                : needsApproval && amountWei > 0n
                  ? "Two signatures: approve, then deposit."
                  : "Deducted per run, from whichever network has a balance."}
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
                  +{gasAmountForChain(addedUsdc6, freshChainId ?? selectedChainId)} <small>{stable}</small>
                </p>
                <p className="gt-done-sub">
                  New balance <b>{gasAmountFromUsdc6(totalBalanceUsdc6)} {POOLED_SYMBOL}</b> — updated everywhere.
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
                    <p className="dm-prog-sub">Keep this window open until it finishes.</p>
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

                <p className="dm-prog-foot">One wallet prompt per step above.</p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
