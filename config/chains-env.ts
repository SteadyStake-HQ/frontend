/**
 * Supported chain IDs from .env. Set NEXT_PUBLIC_SUPPORTED_CHAIN_IDS (comma-separated) to control available networks.
 * 84532 = Base Sepolia, 11155111 = Ethereum Sepolia, 968 = BOT Chain Testnet (testnets).
 * 677 = BOT Chain mainnet.
 * Example: NEXT_PUBLIC_SUPPORTED_CHAIN_IDS=8453,84532,11155111,56,137,677,968
 */
const DEFAULT_CHAIN_IDS = [677, 968, 8453, 84532, 11155111, 56, 2222, 137];

/** BOT Chain is the partner network, so it leads every network list regardless of env order. */
const PRIORITY_CHAIN_IDS = [677, 968];

/** Stable sort that floats PRIORITY_CHAIN_IDS to the front, in the order listed there. */
function botChainFirst(ids: number[]): number[] {
  const rank = (id: number) => {
    const i = PRIORITY_CHAIN_IDS.indexOf(id);
    return i === -1 ? PRIORITY_CHAIN_IDS.length : i;
  };
  return ids
    .map((id, i) => ({ id, i }))
    .sort((a, b) => rank(a.id) - rank(b.id) || a.i - b.i)
    .map((e) => e.id);
}

function parseChainIds(): number[] {
  const raw = process.env.NEXT_PUBLIC_SUPPORTED_CHAIN_IDS?.trim();
  if (!raw) return [...DEFAULT_CHAIN_IDS];
  const ids = raw
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n) && n > 0);
  return ids.length > 0 ? botChainFirst(ids) : [...DEFAULT_CHAIN_IDS];
}

export const SUPPORTED_CHAIN_IDS = parseChainIds();
export type SupportedChainId = (typeof SUPPORTED_CHAIN_IDS)[number];

export function isSupportedChainId(chainId: number): boolean {
  return SUPPORTED_CHAIN_IDS.includes(chainId);
}
