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
  const raw = RAW_BY_CHAIN[chainId]?.trim();
  if (!raw) {
    byChain[chainId] = defaultCost;
    return defaultCost;
  }
  const n = parseFloat(raw);
  byChain[chainId] = Number.isFinite(n) && n > 0 ? n : defaultCost;
  return byChain[chainId];
}

export function getAllGasCostConfig(): Record<number, number> {
  const out: Record<number, number> = {};
  for (const cid of SUPPORTED_CHAIN_IDS) {
    out[cid] = getGasCostPerRunUsd(cid);
  }
  return out;
}
