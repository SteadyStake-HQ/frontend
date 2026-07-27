/**
 * Gas cost per DCA execution (USD) per chain. Used for "required gas tank" estimate (×3 buffer).
 * Set NEXT_PUBLIC_GAS_COST_PER_EXECUTION_USDC for default, or per-chain:
 * NEXT_PUBLIC_GAS_COST_PER_EXECUTION_USDC_84532=0.01
 * NEXT_PUBLIC_GAS_COST_PER_EXECUTION_USDC_8453=0.02
 * A new chain must be added to RAW_BY_CHAIN below or its per-chain var is ignored.
 */
import { SUPPORTED_CHAIN_IDS } from "./chains-env";

const DEFAULT_USD = 0.01;

/**
 * Per-chain default (USD) used when the on-chain gasCostPerExecutionUsdc6 is 0 AND no
 * NEXT_PUBLIC_GAS_COST_PER_EXECUTION_USDC_<chain> override is set. The on-chain value is
 * always the source of truth (see useGasTank.ts); this only backstops the quote/estimate.
 * BOT Chain (mainnet 677 / testnet 968) bills $0.50 per automation execution.
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
};

/** Seed for a chain that has neither measurements nor an entry above. */
const DEFAULT_SEED_GAS_UNITS = 250_000n;

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
