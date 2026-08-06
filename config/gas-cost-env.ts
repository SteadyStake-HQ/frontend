/**
 * The last-resort per-run cost, in USD, per chain.
 *
 * Not a price. Nobody sets what a run costs any more — a run is charged the gas it burned, and
 * every screen quotes either the average of real runs on that chain or a live estimate of the next
 * one (useEstimatedRunCostUsdc6). This file is only what those two fall back to when a chain has
 * never run and its gas price cannot be read, so that a modal has some number to divide by rather
 * than showing a blank.
 *
 * Set NEXT_PUBLIC_GAS_COST_PER_EXECUTION_USDC for the default, or per-chain:
 * NEXT_PUBLIC_GAS_COST_PER_EXECUTION_USDC_84532=0.01
 * NEXT_PUBLIC_GAS_COST_PER_EXECUTION_USDC_8453=0.02
 * A new chain must be added to RAW_BY_CHAIN below or its per-chain var is ignored.
 */
import { SUPPORTED_CHAIN_IDS } from "./chains-env";

const DEFAULT_USD = 0.01;

/**
 * Per-chain backstop (USD), used only when neither a measured average nor a live estimate can be
 * had and no NEXT_PUBLIC_GAS_COST_PER_EXECUTION_USDC_<chain> override is set. The on-chain
 * `gasCostPerExecutionUsdc6` is *not* consulted — nothing in the app reads it (see abis.ts).
 *
 * The BOT Chain figure is a pre-measurement guess from when a run there was priced rather than
 * metered; measured runs on 677 come in far under it. It is left high on purpose — a backstop that
 * overstates makes a tank read emptier than it is, which is the safe direction to be wrong in.
 */
const DEFAULT_BY_CHAIN: Record<number, number> = {
  677: 0.5,
  968: 0.5,
};

/**
 * Next.js inlines NEXT_PUBLIC_* only for statically written `process.env.NAME` accesses,
 * so every supported chain needs its own literal entry here — a computed key would be
 * `undefined` in the browser bundle and silently fall back to the default.
 */
const RAW_BY_CHAIN: Record<number, string | undefined> = {
  677: process.env.NEXT_PUBLIC_GAS_COST_PER_EXECUTION_USDC_677,
  968: process.env.NEXT_PUBLIC_GAS_COST_PER_EXECUTION_USDC_968,
  8453: process.env.NEXT_PUBLIC_GAS_COST_PER_EXECUTION_USDC_8453,
  84532: process.env.NEXT_PUBLIC_GAS_COST_PER_EXECUTION_USDC_84532,
  11155111: process.env.NEXT_PUBLIC_GAS_COST_PER_EXECUTION_USDC_11155111,
  56: process.env.NEXT_PUBLIC_GAS_COST_PER_EXECUTION_USDC_56,
  137: process.env.NEXT_PUBLIC_GAS_COST_PER_EXECUTION_USDC_137,
  2222: process.env.NEXT_PUBLIC_GAS_COST_PER_EXECUTION_USDC_2222,
};

function parseDefault(): number {
  const raw = process.env.NEXT_PUBLIC_GAS_COST_PER_EXECUTION_USDC?.trim();
  if (!raw) return DEFAULT_USD;
  const n = parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_USD;
}

let defaultCost: number | null = null;
const byChain: Record<number, number> = {};

export function getGasCostPerRunUsd(chainId: number): number {
  if (byChain[chainId] != null) return byChain[chainId];
  if (defaultCost === null) defaultCost = parseDefault();
  const fallback = DEFAULT_BY_CHAIN[chainId] ?? defaultCost;
  const raw = RAW_BY_CHAIN[chainId]?.trim();
  if (!raw) {
    byChain[chainId] = fallback;
    return fallback;
  }
  const n = parseFloat(raw);
  byChain[chainId] = Number.isFinite(n) && n > 0 ? n : fallback;
  return byChain[chainId];
}

/**
 * The gas limits the relayer sets on the two transactions a run needs (backend/src/run-executor.ts:
 * `gas: GAS_LIMIT_EXECUTE_SWAP` on the swap, `gas: 100_000n` on recordExecution). These are caps,
 * not costs — the EVM refunds the difference, so pricing a run off them overstates it roughly
 * 2.5x. Kept here only so the two files can be read against each other.
 */
export const EXECUTE_SWAP_GAS_LIMIT = 400_000n;
export const RECORD_EXECUTION_GAS_LIMIT = 100_000n;

/**
 * What a run burns across both transactions, assumed until the relayer has measured it.
 *
 * This is a seed, not the answer. The live figure comes from the backend, which records the gas
 * of every completed run and serves the median per chain (backend/src/gas-profile.ts, read here
 * via /api/gas-profile → app/hooks/useRunCost.ts). These values only fill the window before a
 * chain has run, or while the backend is unreachable.
 *
 * They replaced a single 200,000 shared by every network. Measured on BOT Chain mainnet from
 * relayer receipts, that was low: executeSwap ran 187k–239k and recordExecution 43k–51k, putting
 * a real run at 239k–290k. Keep these in step with SEED_GAS_UNITS in backend/src/gas-profile.ts.
 */
const SEED_GAS_UNITS_BY_CHAIN: Record<number, bigint> = {
  677: 260_000n, // BOT Chain mainnet, median of measured receipts rounded up
  968: 260_000n, // BOT Chain testnet — same contracts, same swap path
  // Unrun chains, split by swap path rather than sharing one constant: a direct DEX adapter
  // (the Sepolia mocks, BOT Chain) burns roughly what BOT Chain measured, a 0x aggregator route
  // more. Both are labelled "estimated" in the UI until that chain's first run replaces them.
  84532: 260_000n, // Base Sepolia — MockSwapRouter
  11155111: 260_000n, // Ethereum Sepolia — MockSwapRouter
  8453: 320_000n, // Base — 0x aggregator route
  56: 320_000n, // BSC — 0x aggregator route
  137: 320_000n, // Polygon — 0x aggregator route
  2222: 320_000n, // Kava — 0x aggregator route
};

/** Seed for a chain that has neither measurements nor an entry above. */
const DEFAULT_SEED_GAS_UNITS = 320_000n;

/** Gas units per run to assume for a chain before the backend has measured one. */
export function getSeedGasUnitsPerRun(chainId: number | undefined): bigint {
  if (chainId == null) return DEFAULT_SEED_GAS_UNITS;
  return SEED_GAS_UNITS_BY_CHAIN[chainId] ?? DEFAULT_SEED_GAS_UNITS;
}

export function getAllGasCostConfig(): Record<number, number> {
  const out: Record<number, number> = {};
  for (const cid of SUPPORTED_CHAIN_IDS) {
    out[cid] = getGasCostPerRunUsd(cid);
  }
  return out;
}
