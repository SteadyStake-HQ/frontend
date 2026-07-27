/**
 * The networks this build offers, resolved from .env at module load.
 *
 * Two variables shape the list, and they compose:
 *   NETWORK_TYPE                     — mainnet | testnet | all. Picks which kind of network is shown.
 *   NEXT_PUBLIC_SUPPORTED_CHAIN_IDS  — comma-separated allow-list, when a deployment wants fewer
 *                                     than every network of that kind.
 *
 * NETWORK_TYPE is applied last and only ever removes, so `NETWORK_TYPE=mainnet` cannot show a
 * testnet no matter what the chain ID list says. That direction is deliberate: a mainnet deployment
 * quietly listing a faucet chain is the failure worth designing against.
 *
 * 84532 = Base Sepolia, 11155111 = Ethereum Sepolia, 968 = BOT Chain Testnet (testnets).
 * 677 = BOT Chain mainnet, 8453 = Base, 56 = BNB Chain, 2222 = Kava, 137 = Polygon.
 *
 * Whether a *registered* network is currently in service (enabled / paused / removed) is decided by
 * the backend at runtime, not here — see lib/network-allocation.ts. This file answers only "which
 * networks can this build talk to at all".
 */
import { matchesNetworkType, NETWORK_TYPE, type NetworkTypeSetting } from "./network-registry";

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

/**
 * Apply NETWORK_TYPE. If the filter would leave nothing — a testnet-only build whose chain ID list
 * happens to name only mainnets — the unfiltered list is kept, because wagmi requires at least one
 * chain and a config with none crashes the app on load. The warning is the actionable part.
 */
function applyNetworkType(ids: number[], setting: NetworkTypeSetting): number[] {
  if (setting === "all") return ids;
  const filtered = ids.filter((id) => matchesNetworkType(id, setting));
  if (filtered.length > 0) return filtered;
  console.warn(
    `NETWORK_TYPE=${setting} matched none of the configured chains (${ids.join(", ")}). ` +
      `Falling back to the unfiltered list — check NEXT_PUBLIC_SUPPORTED_CHAIN_IDS.`,
  );
  return ids;
}

export const SUPPORTED_CHAIN_IDS = applyNetworkType(parseChainIds(), NETWORK_TYPE);
export type SupportedChainId = (typeof SUPPORTED_CHAIN_IDS)[number];

export function isSupportedChainId(chainId: number): boolean {
  return SUPPORTED_CHAIN_IDS.includes(chainId);
}

export { NETWORK_TYPE };
