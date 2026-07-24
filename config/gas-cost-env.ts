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
 * What a run actually burns across both transactions — the figure the relayer is really billed
 * for, and the one to multiply by gas price.
 *
 * Anchored to measurement, not to the limits above: on BOT Chain at 20 gwei a run costs about
 * 0.004 native, which puts both transactions together near this number. The gas a fixed contract
 * call burns barely moves; what moves — and what makes a run cost more on one network than
 * another — is gas price and token price, and both of those are read live per chain rather than
 * tabulated here (see app/hooks/useRunCost.ts). Re-measure from receipts if the vault's swap path
 * changes materially.
 */
export const GAS_UNITS_PER_RUN = 200_000n;

export function getAllGasCostConfig(): Record<number, number> {
  const out: Record<number, number> = {};
  for (const cid of SUPPORTED_CHAIN_IDS) {
    out[cid] = getGasCostPerRunUsd(cid);
  }
  return out;
}
