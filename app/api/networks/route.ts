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
  /**
   * "backend" when the operator's live allocation was read, "unavailable" when it could not be.
   *
   * There is deliberately no third, permissive answer. The build's own chain list says which
   * networks this app *can* talk to, never which ones are in service — inferring the second from
   * the first is how a paused or retired network ends up offered to users during an outage. When
   * the allocation cannot be read the app closes instead: see useNetworkAllocation.
   */
  source: "backend" | "unavailable";
  networkType: string;
  networks: NetworkAllocationEntry[];
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

/** How long to wait on the backend before calling it unreachable. */
const BACKEND_TIMEOUT_MS = 6_000;

/**
 * The allocation could not be read. Answered with 200 and an empty list rather than an error status
 * so the client can tell "the operator's list says nothing is open" apart from "this route itself is
 * broken" — but never cached, because the next request is how the app recovers.
 */
function unavailable(): NextResponse {
  return NextResponse.json(
    {
      source: "unavailable",
      networkType: NETWORK_TYPE,
      networks: [],
    } satisfies NetworkAllocationResponse,
    { headers: { "cache-control": "no-store" } },
  );
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
 *
 * If the backend cannot be read at all, this answers `unavailable` with no networks. The app is
 * closed while that is true — the dashboard does not open and no network can be selected — because
 * the alternative is offering networks whose in-service state nobody can currently vouch for.
 */
export async function GET() {
  const supported = new Set<number>(SUPPORTED_CHAIN_IDS);

  if (!SCHEDULER_API_URL) {
    console.warn(
      "SCHEDULER_API_URL is not set: the network allocation cannot be read, so the app has no " +
        "networks to offer and the dashboard stays closed. Set SCHEDULER_API_URL.",
    );
    return unavailable();
  }

  const query = NETWORK_TYPE === "all" ? "" : `?type=${encodeURIComponent(NETWORK_TYPE)}`;

  try {
    const response = await fetch(
      `${SCHEDULER_API_URL.replace(/\/$/, "")}/api/networks${query}`,
      // Short cache, not none: this is read on every page load, and an operator pausing a network
      // can tolerate a few seconds before the UI catches up. The relayer stops immediately either way.
      // The timeout matters more than it used to: a hanging backend now holds the whole app on its
      // loading gate, so "unreachable" has to be an answer this route reaches quickly.
      {
        headers: { accept: "application/json" },
        next: { revalidate: 10 },
        signal: AbortSignal.timeout(BACKEND_TIMEOUT_MS),
      },
    );
    if (!response.ok) {
      console.warn(
        `Network allocation: backend answered ${response.status} — the app has no networks to ` +
          `offer until it recovers.`,
      );
      return unavailable();
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
    // backend behind a mainnet frontend, say). There is no network both sides would honour, so the
    // app has nothing to offer — that is the same closed state as an unreachable backend, and the
    // warning is what tells the operator it is a misconfiguration rather than an outage.
    if (networks.length === 0) {
      console.warn(
        `Network allocation: the backend returned no network this build supports ` +
          `(NETWORK_TYPE=${NETWORK_TYPE}, build chains=${SUPPORTED_CHAIN_IDS.join(",")}) — ` +
          `the app has no networks to offer. Check that the backend and frontend agree on ` +
          `mainnet/testnet.`,
      );
      return unavailable();
    }

    return NextResponse.json({
      source: "backend",
      networkType: NETWORK_TYPE,
      networks,
    } satisfies NetworkAllocationResponse);
  } catch (error) {
    console.warn(
      `Network allocation: could not reach ${SCHEDULER_API_URL} — the app has no networks to ` +
        `offer until it recovers.`,
      error,
    );
    return unavailable();
  }
}
