/**
 * One deposit, every surface.
 *
 * The gas tank balance is read independently by the dashboard pill, the top-up modal and the
 * create-plan receipt — each through its own `useReadContract`. A deposit made in one of them
 * left the others showing the old number until their staleTime expired, which reads as if the
 * money never arrived. Refreshing has to be global, so it lives here rather than in whichever
 * component happened to send the transaction.
 */
import type { QueryClient } from "@tanstack/react-query";
import { getContracts } from "@/config/contracts";
import { SUPPORTED_CHAIN_IDS } from "@/config/chains-env";

/** Fired after a deposit/withdraw settles, for surfaces that read the tank outside react-query. */
export const GAS_TANK_REFRESH_EVENT = "steadystake-gas-tank-refresh";

const ZERO = "0x0000000000000000000000000000000000000000";

function gasTankAddressesLower(): Set<string> {
  const set = new Set<string>();
  for (const chainId of SUPPORTED_CHAIN_IDS) {
    const tank = getContracts(chainId)?.GasTank;
    if (tank && tank !== ZERO) set.add(tank.toLowerCase());
  }
  return set;
}

/**
 * True for any wagmi contract read that involves a gas tank — its `balanceOf`, and also the
 * USDC `allowance` that names the tank as spender (there the address is the token, so the match
 * has to look at the args too).
 */
function touchesGasTank(queryKey: readonly unknown[], tanks: Set<string>): boolean {
  if (queryKey[0] !== "readContract") return false;
  const config = queryKey[1];
  if (config && typeof config === "object") {
    const addr = (config as { address?: string }).address;
    if (typeof addr === "string" && tanks.has(addr.toLowerCase())) return true;
  }
  const keyStr = JSON.stringify(queryKey, (_, v) =>
    typeof v === "bigint" ? v.toString() : v,
  ).toLowerCase();
  for (const tank of tanks) {
    if (keyStr.includes(tank)) return true;
  }
  return false;
}

export function dispatchGasTankRefresh(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(GAS_TANK_REFRESH_EVENT));
}

/**
 * Invalidate and refetch every gas tank read that is currently mounted, plus the wallet balance
 * the deposit came out of. Awaiting this means the caller can show "done" only once the numbers
 * on screen are the numbers on chain.
 */
export async function refreshGasTankBalances(queryClient: QueryClient): Promise<void> {
  const tanks = gasTankAddressesLower();

  if (tanks.size > 0) {
    const predicate = (query: { queryKey: readonly unknown[] }) =>
      touchesGasTank(query.queryKey, tanks);
    queryClient.invalidateQueries({ predicate });
    await queryClient.refetchQueries({ predicate, type: "active" });
  }

  // The USDC that funded the tank left the wallet — stats and inputs read that too.
  queryClient.invalidateQueries({ queryKey: ["balance"] });
  await queryClient.refetchQueries({ queryKey: ["balance"], type: "active" });

  dispatchGasTankRefresh();
}
