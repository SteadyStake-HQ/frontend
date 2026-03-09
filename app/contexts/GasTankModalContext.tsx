"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { GasTankTopUpModal } from "@/app/components/dashboard/GasTankTopUpModal";

type GasTankModalContextValue = {
  openGasTankModal: () => void;
};

const GasTankModalContext = createContext<GasTankModalContextValue | null>(null);

export function GasTankModalProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const openGasTankModal = useCallback(() => setOpen(true), []);

  return (
    <GasTankModalContext.Provider value={{ openGasTankModal }}>
      {children}
      <GasTankTopUpModal open={open} onClose={() => setOpen(false)} />
    </GasTankModalContext.Provider>
  );
}

export function useGasTankModal(): GasTankModalContextValue {
  const ctx = useContext(GasTankModalContext);
  if (!ctx) {
    return {
      openGasTankModal: () => {},
    };
  }
  return ctx;
}
