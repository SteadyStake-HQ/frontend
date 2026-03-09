"use client";

import { useEffect } from "react";
import { useAccount } from "wagmi";
import { usePathname } from "next/navigation";
import { CHAIN_THEME } from "@/config/wagmi";

const HERO_VARS = ["--hero-primary", "--hero-secondary", "--hero-primary-glow"] as const;

/**
 * Syncs the selected network's brand colors to CSS variables so the gradient
 * background and hero accents update when the user is on dashboard pages.
 *
 * Landing / marketing pages keep the fixed default color scheme from globals.css.
 */
export function NetworkThemeSync() {
  const { chain } = useAccount();
  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;
    const isDashboard = pathname?.startsWith("/dashboard");

    // Always reset to defaults outside of dashboard so landing uses fixed colors
    if (!isDashboard) {
      HERO_VARS.forEach((v) => root.style.removeProperty(v));
      return;
    }

    const theme = chain?.id != null ? CHAIN_THEME[chain.id] : null;

    if (theme) {
      root.style.setProperty("--hero-primary", theme.primary);
      root.style.setProperty("--hero-secondary", theme.secondary);
      root.style.setProperty("--hero-primary-glow", theme.glow);
    } else {
      HERO_VARS.forEach((v) => root.style.removeProperty(v));
    }
  }, [chain?.id, pathname]);

  return null;
}
