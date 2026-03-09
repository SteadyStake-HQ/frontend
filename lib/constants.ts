/**
 * Shared constants (chain names, frequency labels, etc.)
 */

export const CHAIN_NAMES: Record<number, string> = {
  8453: "Base",
  84532: "Base Sepolia",
  11155111: "Ethereum Sepolia",
  56: "BNB Chain",
  137: "Polygon",
  2222: "Kava",
};

export const FREQUENCY_MAP: Record<number, string> = {
  0: "1 min",
  1: "1 day",
  2: "7 days",
  3: "14 days",
  4: "30 days",
};

/** Frequency enum value -> display label */
export const REVERSE_FREQUENCY_MAP: Record<number, string> = {
  0: "1 min",
  1: "Daily",
  2: "Weekly",
  3: "Bi-weekly",
  4: "Monthly",
};

/** Placeholder: resolve token symbol by chain + address (override with token list in callers). */
export function getTokenSymbolForAddress(_chainId: number, _address: string): string {
  return "—";
}

/** Placeholder token list keyed by chain (callers use useSupportedTokens). */
export const SUPPORTED_TOKENS: Record<number, { address: string; symbol: string }[]> = {};

/** Early cancellation: fee charged if less than 50% of schedule executed. */
export function shouldChargeEarlyFee(
  totalAmount: bigint,
  amountPerInterval: bigint,
  executedCount: number,
): boolean {
  if (totalAmount === 0n) return false;
  const totalExecuted = amountPerInterval * BigInt(executedCount);
  return totalExecuted * 2n < totalAmount;
}

/** 3% early cancellation fee on remaining amount. */
export function calculateEarlyFee(remainingAmount: bigint): bigint {
  return (remainingAmount * 3n) / 100n;
}
