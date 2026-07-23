"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useAccount } from "wagmi";
import { ConnectWalletGate } from "../components/dashboard/ConnectWalletGate";
import { DashboardWelcome } from "../components/dashboard/DashboardWelcome";
import { DashboardRefreshButton } from "../components/dashboard/DashboardRefreshButton";
import { Header } from "../components/Header";
import { RevealOnScroll } from "../components/RevealOnScroll";
import { DashboardCharts } from "../components/dashboard/DashboardCharts";
import { DashboardPlans } from "../components/dashboard/DashboardPlans";
import { DashboardStats } from "../components/dashboard/DashboardStats";
import { DashboardStatsProvider } from "../components/dashboard/DashboardStatsContext";
import { NewDcaModal } from "../components/dashboard/NewDcaModal";
import { GasTankButton } from "../components/dashboard/GasTankButton";
import { GasTankModalProvider } from "../contexts/GasTankModalContext";
import { useContracts } from "../hooks";
import { useDashboardStore } from "../store/useDashboardStore";
import { DASHBOARD_REFRESH_EVENT } from "@/lib/dashboard-refresh-event";

const subscribeToHydration = () => () => undefined;
const getClientHydrationSnapshot = () => true;
const getServerHydrationSnapshot = () => false;

export default function DashboardPage() {
  const { isConnected, address, status } = useAccount();
  const { chainId } = useContracts();
  const [newDcaOpen, setNewDcaOpen] = useState(false);
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot,
  );
  const lastFetchKeyRef = useRef<string>("");

  const isWalletResolving =
    !hydrated || status === "connecting" || status === "reconnecting";

  useEffect(() => {
    if (isWalletResolving) return;
    if (!isConnected || !address || chainId == null) {
      useDashboardStore.getState().resetDashboardData();
      lastFetchKeyRef.current = "";
      return;
    }

    const key = `${address.toLowerCase()}-${chainId}`;
    if (lastFetchKeyRef.current === key) return;
    lastFetchKeyRef.current = key;
    void useDashboardStore.getState().fetchDashboardData({ address, chainId, force: true });
  }, [isWalletResolving, isConnected, address, chainId]);

  useEffect(() => {
    if (isWalletResolving || !isConnected || !address || chainId == null) return;

    const onRefresh = () => {
      void useDashboardStore.getState().fetchDashboardData({ address, chainId, force: true });
    };

    window.addEventListener(DASHBOARD_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(DASHBOARD_REFRESH_EVENT, onRefresh);
  }, [isWalletResolving, isConnected, address, chainId]);

  useEffect(() => {
    if (isWalletResolving || !isConnected || !address || chainId == null) return;

    const id = window.setInterval(() => {
      const hasActivePlan = useDashboardStore
        .getState()
        .plans.some(
          (plan) => plan.status === "active",
        );
      if (hasActivePlan) {
        void useDashboardStore
          .getState()
          .fetchDashboardData({ address, chainId, force: true });
      }
    }, 5_000);

    return () => window.clearInterval(id);
  }, [isWalletResolving, isConnected, address, chainId]);

  if (isWalletResolving) {
    return (
      <div className="flex h-screen flex-col overflow-hidden">
        <Header />
        <ConnectWalletGate loading />
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="flex h-screen flex-col overflow-hidden">
        <Header />
        <ConnectWalletGate />
      </div>
    );
  }

  return (
    <GasTankModalProvider>
      <Header />
      <main className="landing-pattern-bg dashboard-main dashboard-surface min-h-screen overflow-hidden border-t border-[var(--hero-muted)]/10 pt-[5.5rem]">
        <div className="dashboard-orb dashboard-orb-one" aria-hidden />
        <div className="dashboard-orb dashboard-orb-two" aria-hidden />
        <div className="relative z-10 mx-auto max-w-7xl px-4 pb-14 pt-3 sm:pt-4">
          <RevealOnScroll className="dashboard-reveal">
            <div className="dashboard-toolbar">
              <p>Overview</p>
              <div className="flex flex-wrap items-center gap-2">
                <GasTankButton />
                <DashboardRefreshButton />
                <Link
                  href="/"
                  title="Go to homepage"
                  aria-label="Go to homepage"
                  className="inline-flex items-center justify-center rounded-lg p-2 text-[var(--hero-muted)] transition-colors hover:bg-[var(--hero-muted)]/10 hover:text-[var(--hero-primary)]"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                </Link>
              </div>
            </div>
          </RevealOnScroll>

          <DashboardStatsProvider>
            <RevealOnScroll className="dashboard-reveal">
              <DashboardWelcome onAddPlan={() => setNewDcaOpen(true)} />
            </RevealOnScroll>
            <RevealOnScroll className="dashboard-reveal dashboard-stagger">
              <DashboardStats />
            </RevealOnScroll>
            <RevealOnScroll className="dashboard-reveal">
              <DashboardCharts onAddPlan={() => setNewDcaOpen(true)} />
            </RevealOnScroll>
          </DashboardStatsProvider>
          <RevealOnScroll className="dashboard-reveal">
            <DashboardPlans onAddPlan={() => setNewDcaOpen(true)} />
          </RevealOnScroll>

          <NewDcaModal open={newDcaOpen} onClose={() => setNewDcaOpen(false)} />
        </div>
      </main>
    </GasTankModalProvider>
  );
}
