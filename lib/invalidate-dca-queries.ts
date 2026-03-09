/**
 * Invalidate and refetch all DCA vault–related queries so dashboard stats, charts, and plan lists
 * update after creating or cancelling a plan. Covers all supported chains' vaults.
 */
import type { QueryClient } from "@tanstack/react-query";
import { getContracts } from "@/config/contracts";
import { SUPPORTED_CHAIN_IDS } from "@/config/chains-env";

function getAllVaultAddressesLower(): Set<string> {
  const set = new Set<string>();
  for (const chainId of SUPPORTED_CHAIN_IDS) {
    const c = getContracts(chainId);
    const vault = c?.DCAVault;
    if (vault && vault !== "0x0000000000000000000000000000000000000000") {
      set.add(vault.toLowerCase());
    }
  }
  return set;
}

function isVaultReadQuery(queryKey: readonly unknown[], vaultAddressesLower: Set<string>): boolean {
  if (queryKey[0] !== "readContract") return false;
  const config = queryKey[1];
  if (config && typeof config === "object") {
    const addr = (config as { address?: string }).address;
    if (typeof addr === "string" && vaultAddressesLower.has(addr.toLowerCase())) return true;
  }
  const keyStr = JSON.stringify(queryKey, (_, v) => (typeof v === "bigint" ? v.toString() : v)).toLowerCase();
  for (const v of vaultAddressesLower) {
    if (keyStr.includes(v)) return true;
  }
  return false;
}

export async function invalidateDcaDashboardQueries(queryClient: QueryClient): Promise<void> {
  const vaultAddressesLower = getAllVaultAddressesLower();

  const predicate = (query: { queryKey: readonly unknown[] }) =>
    isVaultReadQuery(query.queryKey, vaultAddressesLower);

  if (vaultAddressesLower.size > 0) {
    queryClient.invalidateQueries({ predicate });
    queryClient.invalidateQueries({ queryKey: ["dca-vault"] });
    await queryClient.refetchQueries({ predicate });
    await queryClient.refetchQueries({ queryKey: ["dca-vault"] });
  }

  // Refresh wallet balance (e.g. USDC) so dashboard stats show updated balance after deposit
  queryClient.invalidateQueries({ queryKey: ["balance"] });
  await queryClient.refetchQueries({ queryKey: ["balance"] });
}
