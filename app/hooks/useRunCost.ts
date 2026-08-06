"use client";

import { useQuery } from "@tanstack/react-query";
import { useGasPrice } from "wagmi";
import { formatUnits } from "viem";
import { getGasCostPerRunUsd, getSeedGasUnitsPerRun } from "@/config/gas-cost-env";

/**
 * What one scheduled run costs, measured rather than tabulated.
 *
 * Gas is not one number: it is the chain's live gas price times the gas two transactions burn,
 * valued in the token that chain charges in. All three differ per network and two of them move
 * minute to minute, so a hardcoded "0.004 BOT per run" is wrong on every chain but one and goes
 * stale on that one too. Every input is read rather than tabulated: gas price from the network,
 * token price from /api/native-price, and the gas units from /api/gas-profile — which the relayer
 * derives from the receipts of real runs instead of anyone estimating them.
 *
 * This is also what the tank is charged. There is no flat rate any longer: the relayer debits the
 * gas a run actually burned (backend/src/run-executor.ts), so the figure here is not an
 * explanation of someone's price — it is the price, as far ahead of the run as it can be known.
 * Which is why /api/gas-profile also carries what runs were charged: an estimate of a variable
 * cost is worth little without the range the real ones landed in.
 *
 * Both halves are drawn from the whole execution record — every run ever saved on that network,
 * for every user, with no window (backend/src/run-cost-history.ts). That is what an average is
 * supposed to mean, and it is also what makes the estimate right: quoting it against a build-time
 * seed put it roughly a third under the charges the ledger was recording on BNB Chain.
 */

/**
 * Where a quoted price came from. Shown to the user: an operator-set price is not a market one.
 * "botdex" is BOT Chain's own DEX pool (mainnet BOT), "static" is a pinned testnet rate.
 */
export type PriceSource = "override" | "coingecko" | "botdex" | "static" | null;

/** USD price of a chain's native token; null while loading or where no feed quotes it. */
export function useNativePriceUsd(chainId: number | undefined): {
  usd: number | null;
  source: PriceSource;
  isLoading: boolean;
} {
  const enabled = Boolean(chainId && chainId > 0);
  const { data, isLoading } = useQuery({
    queryKey: ["native-price", chainId],
    enabled,
    // A gas estimate does not need a tick-by-tick quote, and the route caches for the same window.
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    retry: 1,
    queryFn: async () => {
      const res = await fetch(`/api/native-price?chainId=${chainId}`);
      if (!res.ok) return { usd: null, source: null as PriceSource };
      const json = (await res.json()) as { usd?: number | null; source?: PriceSource };
      return {
        usd: typeof json.usd === "number" && json.usd > 0 ? json.usd : null,
        source: json.source ?? null,
      };
    },
  });
  return { usd: data?.usd ?? null, source: data?.source ?? null, isLoading: enabled && isLoading };
}

/** Whether the gas-units figure came from real runs or from the pre-measurement seed. */
export type GasUnitsSource = "measured" | "seed";

/**
 * Which record the measured figures were drawn from.
 *
 * "history" is the durable one — every execution ever saved on that network, for every user, with
 * no window. "relayer" is the running backend process's own samples, which is all there is when no
 * database is configured and which starts empty after every redeploy. "seed" means nothing has run
 * there yet. Worth distinguishing because only the first is a claim about the network rather than
 * about whatever the current process happened to watch.
 */
export type RunCostBasis = "history" | "relayer" | "seed";

/**
 * What runs on a network were charged, in dollars.
 *
 * Drawn from every recorded execution on that chain — every user, no window — so `avgUsd` is what
 * a run there typically costs and `maxUsd` the worst one on record. Both published because the
 * charge follows gas, and a range is the honest form of a number that moves. Null throughout until
 * a chain has run at least once.
 */
export interface RunCostStats {
  samples: number;
  avgUsd: number | null;
  maxUsd: number | null;
  minUsd: number | null;
  lastUsd: number | null;
  /** Runs paid out of another network's tank — the ones that cost the premium. */
  crossChainSamples: number;
  crossChainAvgUsd: number | null;
  sameChainAvgUsd: number | null;
}

const NO_COST_STATS: RunCostStats = {
  samples: 0,
  avgUsd: null,
  maxUsd: null,
  minUsd: null,
  lastUsd: null,
  crossChainSamples: 0,
  crossChainAvgUsd: null,
  sameChainAvgUsd: null,
};

/**
 * The relayer's headroom on the deduction leg, assumed when the backend does not state it. Kept in
 * step with RECORD_BUFFER_BPS in backend/src/gas-profile.ts.
 */
const DEFAULT_RECORD_BUFFER_BPS = 12000;

/**
 * A chain's measured profile: the gas one run burns, leg by leg, and what runs there were charged.
 *
 * Falls back to that chain's seed gas whenever the backend has nothing to say, so the gas figure
 * never resolves to null and the modal always has a number to multiply; the cost statistics do go
 * empty, because inventing a history of charges that never happened is a different thing entirely.
 *
 * The two legs come back separately because the relayer does not charge for them the same way. The
 * swap is billed at exactly what its receipt records. The deduction that follows cannot be — the
 * amount it debits is an argument to it, so it has to be priced before it is sent — and is billed
 * at its measured gas widened by `recordBufferBps`. An estimate built from the two-leg total alone
 * leaves that headroom out and comes in under the real charge every time.
 */
export function useRunGasProfile(chainId: number | undefined): {
  /** Gas both transactions burn — what a run costs the relayer. */
  gasUnits: bigint;
  /** Gas the run is *billed* for: the swap leg plus the deduction leg with its headroom on top. */
  chargeableGasUnits: bigint;
  /** The busy-day figure, where the record has enough runs to have one. */
  gasUnitsP90: bigint | null;
  source: GasUnitsSource;
  basis: RunCostBasis;
  samples: number;
  cost: RunCostStats;
} {
  const enabled = Boolean(chainId && chainId > 0);
  const { data } = useQuery({
    queryKey: ["gas-profile", chainId],
    enabled,
    // Only a completed run changes this, and runs are minutes apart at best.
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    retry: 1,
    queryFn: async () => {
      const res = await fetch(`/api/gas-profile?chainId=${chainId}`);
      if (!res.ok) return null;
      return (await res.json()) as {
        gasUnitsPerRun?: number;
        swapGasUnits?: number | null;
        recordGasUnits?: number | null;
        recordBufferBps?: number;
        gasUnitsP90?: number | null;
        samples?: number;
        source?: GasUnitsSource;
        basis?: RunCostBasis;
        cost?: Partial<RunCostStats>;
      };
    },
  });

  const cost: RunCostStats = { ...NO_COST_STATS, ...(data?.cost ?? {}) };
  const units = data?.gasUnitsPerRun;
  const measured = typeof units === "number" && Number.isFinite(units) && units > 0;
  const gasUnits = measured ? BigInt(Math.round(units!)) : getSeedGasUnitsPerRun(chainId);

  /*
   * The billed figure. Both legs have to be known separately to build it: with only the total, the
   * split between them is unknown and the headroom cannot be applied to the right half. Where the
   * record has not yet measured the legs apart, the total stands in unwidened — an estimate a
   * little under is better than one inflated by a buffer applied to gas it does not belong to.
   */
  const swap = positive(data?.swapGasUnits);
  const record = positive(data?.recordGasUnits);
  const bufferBps =
    typeof data?.recordBufferBps === "number" && data.recordBufferBps > 0
      ? data.recordBufferBps
      : DEFAULT_RECORD_BUFFER_BPS;
  const chargeableGasUnits =
    swap != null && record != null
      ? BigInt(Math.round(swap + (record * bufferBps) / 10000))
      : gasUnits;

  const p90 = positive(data?.gasUnitsP90);

  return {
    gasUnits,
    chargeableGasUnits,
    gasUnitsP90: p90 != null ? BigInt(Math.round(p90)) : null,
    source: measured && data?.source === "measured" ? "measured" : "seed",
    basis: data?.basis ?? "seed",
    samples: data?.samples ?? 0,
    cost,
  };
}

function positive(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

export interface RunCostBreakdown {
  /** Live gas price on this chain, in wei. */
  gasPriceWei: bigint | null;
  /** Gas price in gwei, for display. */
  gasPriceGwei: number | null;
  /**
   * Native token per run, as the tank is billed for it: gas price × `chargeableGasUnits`. This is
   * the figure `liveUsd` is the dollar value of, so the two rows multiply out on screen.
   */
  feeNative: number | null;
  /** Native the two transactions actually burn, without the deduction leg's headroom. */
  burnNative: number | null;
  /** USD price of the native token, where one is available. */
  nativeUsd: number | null;
  /** Which feed that price came from — a market quote and a configured one are not the same claim. */
  nativeSource: PriceSource;
  /** Gas both transactions burn, measured from real runs where there are any on record. */
  gasUnits: bigint;
  /** Gas the run is billed for — the swap leg plus the deduction leg with its headroom. */
  chargeableGasUnits: bigint;
  /** The busy-day gas figure, where the record has enough runs to have one. */
  gasUnitsP90: bigint | null;
  /** Whether those units are measured or still the seed. */
  gasUnitsSource: GasUnitsSource;
  /** Which record they were measured from. */
  basis: RunCostBasis;
  /** How many runs the measured figure is drawn from. 0 while seeded. */
  gasUnitsSamples: number;
  /** What a run costs right now, in USD — and so what the tank will be charged for the next one. */
  liveUsd: number | null;
  /** What runs on this network really cost, for the range around that estimate. */
  cost: RunCostStats;
  isLoading: boolean;
}

/**
 * The live estimate, term by term.
 *
 * `liveUsd` mirrors what the relayer will actually debit rather than approximating it. The relayer
 * charges the gas the swap's receipt records, plus the deduction leg priced ahead of itself at its
 * measured gas widened by the record buffer, both at the chain's gas price and its token's USD
 * price (backend/src/run-executor.ts). So the multiplication here is
 * `chargeableGasUnits × gasPrice × nativeUsd` — where `chargeableGasUnits` already carries the
 * headroom, and where the gas figure is the median of every run on record for that network rather
 * than a build-time constant. Quoting the bare two-leg total against a seed was the whole reason
 * the estimate came in roughly a third under the charges on the ledger.
 */
export function useRunCostBreakdown(chainId: number | undefined): RunCostBreakdown {
  const enabled = Boolean(chainId && chainId > 0);
  const { data: gasPriceWei, isLoading: gasLoading } = useGasPrice({
    chainId,
    query: {
      enabled,
      staleTime: 30_000,
      // Gas prices move; a modal left open should not keep quoting the price at open time.
      refetchInterval: 60_000,
      retry: 1,
    },
  });
  const {
    usd: nativeUsd,
    source: nativeSource,
    isLoading: priceLoading,
  } = useNativePriceUsd(chainId);

  const {
    gasUnits,
    chargeableGasUnits,
    gasUnitsP90,
    source: gasUnitsSource,
    basis,
    samples: gasUnitsSamples,
    cost,
  } = useRunGasProfile(chainId);

  const feeNative =
    gasPriceWei != null ? Number(formatUnits(gasPriceWei * chargeableGasUnits, 18)) : null;
  const burnNative = gasPriceWei != null ? Number(formatUnits(gasPriceWei * gasUnits, 18)) : null;
  const liveUsd = feeNative != null && nativeUsd != null ? feeNative * nativeUsd : null;

  return {
    gasPriceWei: gasPriceWei ?? null,
    gasPriceGwei: gasPriceWei != null ? Number(formatUnits(gasPriceWei, 9)) : null,
    feeNative,
    burnNative,
    nativeUsd,
    nativeSource,
    gasUnits,
    chargeableGasUnits,
    gasUnitsP90,
    gasUnitsSource,
    basis,
    gasUnitsSamples,
    liveUsd,
    cost,
    isLoading: gasLoading || priceLoading,
  };
}

/** Where the quoted per-run charge came from, best first. */
export type RunCostSource = "measured" | "live" | "config";

/** What a run costs on a chain, in dollars, with the evidence behind the figure. */
export interface RunCostUsd {
  /** What a run typically costs — the average of real runs where there are any. */
  typicalUsd: number;
  /** The worst run observed, for anything sizing a commitment rather than describing one. */
  worstUsd: number;
  source: RunCostSource;
  /** The raw record behind the two figures above: sample count, spread, cross-chain split. */
  cost: RunCostStats;
  /** Gas both transactions burn, and whether that is measured or still seeded. */
  gasUnits: bigint;
  gasUnitsSource: GasUnitsSource;
  /** Which record the measured figures came from. */
  basis: RunCostBasis;
  gasPriceGwei: number | null;
  nativeUsd: number | null;
  nativeSource: PriceSource;
  isLoading: boolean;
}

/**
 * What one run costs on a chain, in dollars — the single precedence rule behind every quoted
 * figure, so the landing page's worked example and the dashboard's prepay cannot disagree.
 *
 *   measured — the average of what the last runs on this network really cost. Not an estimate.
 *   live     — gas price × gas burned × token price, for a chain that has not run yet.
 *   config   — the build-time per-chain backstop, when even that cannot be read.
 *
 * `worstUsd` is the most expensive run in the window, or the typical one where nothing has been
 * observed: a single seeded estimate is not evidence of a spread, and inventing one would
 * overstate what a plan needs banked.
 */
export function useRunCostUsd(chainId: number | undefined): RunCostUsd {
  const {
    liveUsd,
    cost,
    gasUnits,
    gasUnitsSource,
    basis,
    gasPriceGwei,
    nativeUsd,
    nativeSource,
    isLoading,
  } = useRunCostBreakdown(chainId);

  const typicalUsd = cost.avgUsd ?? liveUsd ?? getGasCostPerRunUsd(chainId ?? 0);
  const source: RunCostSource =
    cost.avgUsd != null ? "measured" : liveUsd != null ? "live" : "config";

  return {
    typicalUsd,
    /*
     * The worst run on record, or — where the record has nothing worse than the typical figure to
     * offer — the live estimate, so a chain whose gas price has risen since its last run is not
     * sized on a cheaper day than the one it is about to have.
     */
    worstUsd: Math.max(cost.maxUsd ?? 0, typicalUsd, liveUsd ?? 0),
    source,
    cost,
    gasUnits,
    gasUnitsSource,
    basis,
    gasPriceGwei,
    nativeUsd,
    nativeSource,
    // A measured average is the answer, so there is nothing left to wait for even while the
    // live-estimate inputs it would have fallen back to are still in flight.
    isLoading: source === "measured" ? false : isLoading,
  };
}

/** Small native amounts need significant digits, not decimal places: 0.0000412 ETH is real. */
export function formatNativeAmount(n: number): string {
  if (n === 0) return "0";
  if (n < 0.000001) return "<0.000001";
  return n.toLocaleString("en-US", { maximumSignificantDigits: 3 });
}

/** A token price: cents for normal tokens, significant digits for ones worth fractions of one. */
export function formatUsdPrice(n: number): string {
  return n >= 1
    ? `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$${n.toLocaleString("en-US", { maximumSignificantDigits: 3 })}`;
}
