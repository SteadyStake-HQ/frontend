import { NextResponse } from "next/server";
import { SUPPORTED_CHAIN_IDS } from "@/config/chains-env";
import { getNetworkType, NETWORK_TYPE } from "@/config/network-registry";
import { CHAIN_NAMES } from "@/lib/constants";

const SCHEDULER_API_URL =
  process.env.SCHEDULER_API_URL ??
  process.env.NEXT_PUBLIC_SCHEDULER_API_URL ??
  (process.env.NODE_ENV === "development" ? "http://127.0.0.1:3340" : "");

export const dynamic = "force-dynamic";

/** How a network is currently allocated by the operator. Mirrors the backend's NetworkStatus. */
export type NetworkStatus = "enabled" | "paused" | "disabled";

export interface NetworkAllocationEntry {
  chainId: number;
  name: string;
  type: "mainnet" | "testnet" | null;
  status: NetworkStatus;
  /** Shown in the UI. False only for a removed network. */
  visible: boolean;
  /** New plans may be created here. False when the operator has paused or removed the network. */
  acceptsNewPlans: boolean;
  /** Operator's explanation, e.g. why the network is paused. Safe to show to users. */
  note: string | null;
}

export interface NetworkAllocationResponse {
  /** "backend" when the operator's live allocation was read, "static" when it could not be. */
  source: "backend" | "static";
  networkType: string;
  networks: NetworkAllocationEntry[];
}

/**
 * The build's own answer: every network this build can talk to, all in service.
 *
 * This is the fallback, and it is deliberately permissive. An unreachable backend must not take the
 * app's networks away from users mid-session — the build-time list is what the app shipped with, and
 * the relayer enforces pauses on its own side regardless of what the UI believes.
 */
/**
 * Display name for a chain the build already knows about.
 *
 * The fallback list is rendered to users, so it must not invent placeholder names: `Chain 677` in
 * the network switcher is indistinguishable from a rendering bug. lib/constants names every chain
 * in SUPPORTED_CHAIN_IDS, and `Chain <id>` is left only for an id no table covers.
 */
function chainName(chainId: number): string {
  return CHAIN_NAMES[chainId] ?? `Chain ${chainId}`;
}

function staticNetworks(): NetworkAllocationEntry[] {
  return SUPPORTED_CHAIN_IDS.map((chainId) => ({
    chainId,
    name: chainName(chainId),
    type: getNetworkType(chainId),
    status: "enabled" as const,
    visible: true,
    acceptsNewPlans: true,
    note: null,
  }));
}

interface BackendNetwork {
  chainId?: number;
  name?: string;
  type?: string;
  status?: string;
  visible?: boolean;
  acceptsNewPlans?: boolean;
  note?: string | null;
}

function isStatus(value: unknown): value is NetworkStatus {
  return value === "enabled" || value === "paused" || value === "disabled";
}

/**
 * GET /api/networks -> { source, networkType, networks[] }
 *
 * Which networks this deployment offers right now: the build's NETWORK_TYPE list, narrowed by what
 * the operator has enabled, paused, or removed on the backend.
 *
 * The backend answer is intersected with the build's own chain list rather than replacing it. The
 * frontend can only actually transact on a chain it has a wagmi entry, contract addresses, and a
 * token list for, so a network enabled on the backend but absent from this build is not something
 * the UI can honour by listing it.
 */
export async function GET() {
  const supported = new Set<number>(SUPPORTED_CHAIN_IDS);
  const fallback: NetworkAllocationResponse = {
    source: "static",
    networkType: NETWORK_TYPE,
    networks: staticNetworks(),
  };

  if (!SCHEDULER_API_URL) {
    // Silent here would mean an operator pausing a network in the dashboard and seeing nothing
    // change in the app, with no clue why — the fallback list says every network is in service.
    console.warn(
      "SCHEDULER_API_URL is not set: serving the build's own network list. " +
        "Network pauses and removals made in the operator dashboard will NOT reach the frontend.",
    );
    return NextResponse.json(fallback);
  }

  const query = NETWORK_TYPE === "all" ? "" : `?type=${encodeURIComponent(NETWORK_TYPE)}`;

  try {
    const response = await fetch(
      `${SCHEDULER_API_URL.replace(/\/$/, "")}/api/networks${query}`,
      // Short cache, not none: this is read on every page load, and an operator pausing a network
      // can tolerate a few seconds before the UI catches up. The relayer stops immediately either way.
      { headers: { accept: "application/json" }, next: { revalidate: 10 } },
    );
    if (!response.ok) {
      console.warn(
        `Network allocation: backend answered ${response.status} — serving the build's own list. ` +
          `Pauses and removals will NOT be visible in the app.`,
      );
      return NextResponse.json(fallback);
    }
    const data = (await response.json()) as { networks?: BackendNetwork[] };
    const networks = (data?.networks ?? [])
      .filter((n): n is BackendNetwork & { chainId: number } =>
        typeof n?.chainId === "number" && supported.has(n.chainId),
      )
      .map<NetworkAllocationEntry>((n) => ({
        chainId: n.chainId,
        // Prefer the name this build knows: it is the one the rest of the UI and the wallet use, so
        // a backend rename cannot make the switcher disagree with the header.
        name:
          CHAIN_NAMES[n.chainId] ??
          (typeof n.name === "string" && n.name.trim() ? n.name.trim() : `Chain ${n.chainId}`),
        type: n.type === "mainnet" || n.type === "testnet" ? n.type : getNetworkType(n.chainId),
        status: isStatus(n.status) ? n.status : "enabled",
        visible: n.visible !== false,
        acceptsNewPlans: n.acceptsNewPlans !== false,
        note: typeof n.note === "string" && n.note.trim() ? n.note.trim() : null,
      }));

    // An empty intersection means the two sides disagree about this deployment entirely (a testnet
    // backend behind a mainnet frontend, say). Showing nothing would look like an outage, so keep
    // the build's list and let the relayer be the one that refuses.
    if (networks.length === 0) {
      console.warn(
        `Network allocation: the backend returned no network this build supports ` +
          `(NETWORK_TYPE=${NETWORK_TYPE}, build chains=${SUPPORTED_CHAIN_IDS.join(",")}) — ` +
          `serving the build's own list. Check that the backend and frontend agree on mainnet/testnet.`,
      );
      return NextResponse.json(fallback);
    }

    return NextResponse.json({
      source: "backend",
      networkType: NETWORK_TYPE,
      networks,
    } satisfies NetworkAllocationResponse);
  } catch (error) {
    console.warn(
      `Network allocation: could not reach ${SCHEDULER_API_URL} — serving the build's own list. ` +
        `Pauses and removals will NOT be visible in the app.`,
      error,
    );
    return NextResponse.json(fallback);
  }
}
