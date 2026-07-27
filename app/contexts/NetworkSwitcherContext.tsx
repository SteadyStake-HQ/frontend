"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { NetworkSwitcherModal } from "@/app/components/NetworkSwitcherModal";

type NetworkSwitcherContextValue = {
  openNetworkSwitcher: () => void;
};

const NetworkSwitcherContext = createContext<NetworkSwitcherContextValue | null>(null);

/**
 * Owns the one network switcher for the app. Mounted in Providers, inside WagmiProvider, so the
 * header button and the "Wrong network" button open the same modal instead of RainbowKit's — which
 * lists every chain in the build regardless of what the operator has allocated.
 */
export function NetworkSwitcherProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const openNetworkSwitcher = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);
  const value = useMemo(() => ({ openNetworkSwitcher }), [openNetworkSwitcher]);

  return (
    <NetworkSwitcherContext.Provider value={value}>
      {children}
      {open && <NetworkSwitcherModal onClose={close} />}
    </NetworkSwitcherContext.Provider>
  );
}

export function useNetworkSwitcher(): NetworkSwitcherContextValue {
  return useContext(NetworkSwitcherContext) ?? { openNetworkSwitcher: () => {} };
}
