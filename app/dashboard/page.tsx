"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { CustomConnectButton } from "../components/CustomConnectButton";
import { DashboardRefreshButton } from "../components/dashboard/DashboardRefreshButton";
import { Header } from "../components/Header";
import { RevealOnScroll } from "../components/RevealOnScroll";
import { DashboardCharts } from "../components/dashboard/DashboardCharts";
import { DashboardPlans } from "../components/dashboard/DashboardPlans";
import { DashboardStats } from "../components/dashboard/DashboardStats";
import { DashboardStatsProvider } from "../components/dashboard/DashboardStatsContext";
import { NewDcaModal } from "../components/dashboard/NewDcaModal";
import { useContracts } from "../hooks";
import { useDashboardStore } from "../store/useDashboardStore";
import { DASHBOARD_REFRESH_EVENT } from "@/lib/dashboard-refresh-event";

export default function DashboardPage() {
  const { isConnected, address, status } = useAccount();
  const { chainId } = useContracts();
  const [newDcaOpen, setNewDcaOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const lastFetchKeyRef = useRef<string>("");

  useEffect(() => {
    setHydrated(true);
  }, []);

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

  if (isWalletResolving) {
    return (
      <div className="flex h-screen flex-col overflow-hidden">
        <Header />
        <main className="landing-pattern-bg dashboard-connect-screen flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden border-t border-[var(--hero-muted)]/10 px-4 pt-[5.5rem]">
          <div className="mx-auto w-full min-w-0 max-w-md">
            <div className="dashboard-connect-card relative overflow-hidden rounded-3xl border border-[var(--hero-muted)]/20 p-6 text-center shadow-lg shadow-black/40 sm:p-8">
              <div className="dashboard-connect-card-base absolute inset-0 z-0" aria-hidden />
              <div className="dashboard-connect-card-frost pointer-events-none absolute inset-0 z-10" aria-hidden />
              <div className="relative z-20 flex flex-col items-center">
                <div className="h-12 w-12 animate-spin rounded-full border-2 border-[var(--hero-primary)]/20 border-t-[var(--hero-primary)]" />
                <p className="mt-4 text-sm font-medium text-[var(--foreground)]">
                  Loading your dashboard...
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="flex h-screen flex-col overflow-hidden">
        <Header />
        <main className="landing-pattern-bg dashboard-connect-screen flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden border-t border-[var(--hero-muted)]/10 px-4 pt-[5.5rem]">
          <div className="mx-auto w-full min-w-0 max-w-md">
            <div className="dashboard-connect-card relative overflow-hidden rounded-3xl border border-[var(--hero-muted)]/20 p-6 text-center shadow-lg shadow-black/40 sm:p-8">
              <div className="dashboard-connect-card-base absolute inset-0 z-0" aria-hidden />
              <div className="dashboard-connect-card-frost pointer-events-none absolute inset-0 z-10" aria-hidden />
              <div className="relative z-20">
                <div
                  className="mx-auto mb-5 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--hero-primary)] shadow-md sm:mb-6 sm:h-16 sm:w-16"
                  aria-hidden
                >
                  <svg className="h-7 w-7 text-white sm:h-8 sm:w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a2.25 2.25 0 00-2.25-2.25H15a2.25 2.25 0 01-2.25-2.25c0-1.152.26-2.243.723-3.218C15.767 3.5 16.5 3 17.25 3h1.5A2.25 2.25 0 0121 5.25v6.5zM3.75 21a2.25 2.25 0 002.25-2.25V15a2.25 2.25 0 012.25-2.25c1.152 0 2.243.26 3.218.723C9.733 14.233 10.5 14.75 11.25 15h6.5A2.25 2.25 0 0120 17.25v.75M3.75 21h13.5A2.25 2.25 0 0019.5 18.75v-6.5a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 12.25v6.5A2.25 2.25 0 003.75 21z" />
                  </svg>
                </div>
                <h1 className="text-xl font-bold tracking-tight text-[var(--foreground)] sm:text-2xl">
                  Connect your wallet
                </h1>
                <p className="mt-2 text-sm text-[var(--hero-muted)] sm:text-base">
                  Use Rainbow or any supported wallet to view your DCA dashboard and create plans.
                </p>
                <div className="mt-6 flex w-full min-w-0 flex-col items-stretch gap-3 sm:mt-8 sm:flex-row sm:justify-center sm:gap-4">
                  <span className="flex justify-center sm:inline-flex">
                    <CustomConnectButton
                      label="Connect wallet"
                      size="md"
                      variant="primary"
                      className="!h-12 !min-h-12 !max-h-12 !rounded-2xl py-0 shadow-md shadow-[var(--hero-primary)]/25 transition-transform hover:scale-[1.02] hover:shadow-lg hover:shadow-[var(--hero-primary)]/30 active:scale-[0.98]"
                    />
                  </span>
                  <Link
                    href="/"
                    className="inline-flex h-12 min-h-12 max-h-12 items-center justify-center gap-2 rounded-2xl border-2 border-[var(--hero-muted)]/20 bg-[color-mix(in_srgb,var(--foreground)_0.03)] px-5 text-sm font-semibold text-[var(--foreground)] transition-all duration-200 hover:scale-[1.02] hover:border-[var(--hero-primary)]/30 hover:bg-[var(--hero-primary)]/5 hover:shadow-md hover:shadow-[var(--hero-primary)]/10"
                  >
                    <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Back to home
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <>
      <Header />
      <main className="landing-pattern-bg dashboard-main min-h-screen overflow-hidden border-t border-[var(--hero-muted)]/10 pt-[5.5rem]">
        <div className="relative z-10 mx-auto max-w-7xl p-4">
          <RevealOnScroll className="dashboard-reveal">
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-2">
                <div className="flex">
                  <h1 className="mr-2 text-2xl font-bold tracking-tight text-[var(--foreground)] md:text-3xl">
                    Dashboard
                  </h1>
                  <DashboardRefreshButton />
                </div>
                <p className="self-end pb-0.5 text-sm text-[var(--hero-muted)]">
                  Manage your DCA plans and track performance
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 rounded-xl border border-[var(--hero-muted)]/30 bg-transparent px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] transition-colors hover:border-[var(--hero-primary)]/50 hover:bg-[var(--hero-primary)]/5"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  Go to homepage
                </Link>
                <button
                  type="button"
                  onClick={() => setNewDcaOpen(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-95 active:scale-[0.98]"
                  style={{ backgroundColor: "var(--hero-primary)" }}
                >
                  <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  New DCA plan
                </button>
              </div>
            </div>
          </RevealOnScroll>

          <DashboardStatsProvider>
            <RevealOnScroll className="dashboard-reveal dashboard-stagger">
              <DashboardStats />
            </RevealOnScroll>
            <RevealOnScroll className="dashboard-reveal">
              <DashboardCharts />
            </RevealOnScroll>
          </DashboardStatsProvider>
          <RevealOnScroll className="dashboard-reveal">
            <DashboardPlans onAddPlan={() => setNewDcaOpen(true)} />
          </RevealOnScroll>

          <NewDcaModal open={newDcaOpen} onClose={() => setNewDcaOpen(false)} />
        </div>
      </main>
    </>
  );
}
