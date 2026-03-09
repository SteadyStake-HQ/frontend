/**
 * Gas cost per DCA execution (USD) per chain. Used for "required gas tank" estimate (×3 buffer).
 * Set NEXT_PUBLIC_GAS_COST_PER_EXECUTION_USDC for default, or per-chain:
 * NEXT_PUBLIC_GAS_COST_PER_EXECUTION_USDC_84532=0.01
 * NEXT_PUBLIC_GAS_COST_PER_EXECUTION_USDC_8453=0.02
 */
import { SUPPORTED_CHAIN_IDS } from "./chains-env";

const DEFAULT_USD = 0.01;

function parseDefault(): number {
  const raw = process.env.NEXT_PUBLIC_GAS_COST_PER_EXECUTION_USDC?.trim();
  if (!raw) return DEFAULT_USD;
  const n = parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_USD;
}

function parseForChain(chainId: number): number {
  const raw = process.env[`NEXT_PUBLIC_GAS_COST_PER_EXECUTION_USDC_${chainId}`]?.trim();
  if (!raw) return parseDefault();
  const n = parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : parseDefault();
}

let defaultCost: number | null = null;
const byChain: Record<number, number> = {};

export function getGasCostPerRunUsd(chainId: number): number {
  if (byChain[chainId] != null) return byChain[chainId];
  if (defaultCost === null) defaultCost = parseDefault();
  const raw = process.env[`NEXT_PUBLIC_GAS_COST_PER_EXECUTION_USDC_${chainId}`]?.trim();
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
