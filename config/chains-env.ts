/**
 * Supported chain IDs from .env. Set NEXT_PUBLIC_SUPPORTED_CHAIN_IDS (comma-separated) to control available networks.
 * 84532 = Base Sepolia, 11155111 = Ethereum Sepolia (both testnets for testing).
 * Example: NEXT_PUBLIC_SUPPORTED_CHAIN_IDS=8453,84532,11155111,56,137
 */
const DEFAULT_CHAIN_IDS = [8453, 84532, 11155111, 56, 2222, 137];

function parseChainIds(): number[] {
  const raw = process.env.NEXT_PUBLIC_SUPPORTED_CHAIN_IDS?.trim();
  if (!raw) return [...DEFAULT_CHAIN_IDS];
  const ids = raw
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n) && n > 0);
  return ids.length > 0 ? ids : [...DEFAULT_CHAIN_IDS];
}

export const SUPPORTED_CHAIN_IDS = parseChainIds();
export type SupportedChainId = (typeof SUPPORTED_CHAIN_IDS)[number];

export function isSupportedChainId(chainId: number): boolean {
  return SUPPORTED_CHAIN_IDS.includes(chainId);
}
