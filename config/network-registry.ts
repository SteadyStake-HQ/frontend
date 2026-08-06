/**
 * Which networks are mainnets and which are testnets, and which of the two lists this deployment
 * shows.
 *
 * Set NETWORK_TYPE in .env to pick the list:
 *   NETWORK_TYPE=mainnet   → BOT Chain, Base, BNB Chain, Kava, Polygon
 *   NETWORK_TYPE=testnet   → BOT Chain Testnet, Base Sepolia, Ethereum Sepolia
 *   NETWORK_TYPE=all       → every supported network (the previous mixed behaviour)
 *
 * Unset behaves as `all`, so an existing deployment keeps the list it has today until it opts in.
 *
 * This table mirrors `type` in backend/src/networks/network-registry.ts, which is the source of
 * truth and where a new chain is registered. It is duplicated here for the same reason
 * deployed-addresses.json is: the frontend builds its wagmi config before it can reach the backend,
 * so the classification has to be available at module load.
 */

export const NETWORK_TYPES = ["mainnet", "testnet"] as const;
export type NetworkType = (typeof NETWORK_TYPES)[number];

/** Every chain the frontend can talk to, and what kind of network it is. */
export const NETWORK_TYPE_BY_CHAIN: Record<number, NetworkType> = {
  677: "mainnet", // BOT Chain
  968: "testnet", // BOT Chain Testnet
  8453: "mainnet", // Base
  84532: "testnet", // Base Sepolia
  11155111: "testnet", // Ethereum Sepolia
  56: "mainnet", // BNB Chain
  2222: "mainnet", // Kava
  137: "mainnet", // Polygon
};

export function getNetworkType(chainId: number): NetworkType | null {
  return NETWORK_TYPE_BY_CHAIN[chainId] ?? null;
}

export function isNetworkType(value: unknown): value is NetworkType {
  return typeof value === "string" && (NETWORK_TYPES as readonly string[]).includes(value);
}

/** What NETWORK_TYPE resolves to: one of the two lists, or `all` for the unfiltered set. */
export type NetworkTypeSetting = NetworkType | "all";

/**
 * NETWORK_TYPE from the environment.
 *
 * Read from NEXT_PUBLIC_NETWORK_TYPE because the chain list is built in the browser; next.config.ts
 * copies a plain `NETWORK_TYPE` into it, so either name works in .env.
 */
export function getNetworkTypeSetting(): NetworkTypeSetting {
  const raw = (process.env.NEXT_PUBLIC_NETWORK_TYPE ?? "").trim().toLowerCase();
  if (!raw || raw === "all") return "all";
  if (isNetworkType(raw)) return raw;
  // A typo here would otherwise silently show mainnets on a testnet deployment, or the reverse.
  // Falling back to the unfiltered list is the visible failure, not the dangerous one.
  console.warn(
    `NETWORK_TYPE="${raw}" is not recognised; expected "mainnet", "testnet", or "all". Showing all networks.`,
  );
  return "all";
}

export const NETWORK_TYPE: NetworkTypeSetting = getNetworkTypeSetting();

/** True when `chainId` belongs in the list this deployment shows. */
export function matchesNetworkType(
  chainId: number,
  setting: NetworkTypeSetting = NETWORK_TYPE,
): boolean {
  if (setting === "all") return true;
  // A chain missing from the table is not classified, so it cannot be claimed for either list.
  return getNetworkType(chainId) === setting;
}
