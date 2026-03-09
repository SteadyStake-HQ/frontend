/**
 * Custom event dispatched after creating (or cancelling) a DCA plan so the dashboard
 * and plan list can refetch and show updated info.
 */
export const DASHBOARD_REFRESH_EVENT = "steadystake-dashboard-refresh";

export function dispatchDashboardRefresh(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(DASHBOARD_REFRESH_EVENT));
}
