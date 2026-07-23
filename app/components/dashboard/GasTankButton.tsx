"use client";

import { useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { useContracts } from "@/app/hooks/useContracts";
import { useGasTankAllChains, useGasTankLevel, getChainsWithGasTank } from "@/app/hooks/useGasTank";
import { useGasTankModal } from "@/app/contexts/GasTankModalContext";
import { AnimatedGasAmount, GasTankIcon, gasAmountFromUsdc6 } from "./GasTankVisuals";

/**
 * Dashboard entry point to the gas tank.
 *
 * Until this existed the only way to put USDC in the tank was to create an auto-execution plan,
 * which forced a top-up into every plan and gave users no way to refill one that ran dry.
 *
 * It doubles as the tank's status light: the level bar drains as the relayer spends, and the pill
 * turns amber before it empties, because a plan that stops for want of gas is the failure this
 * screen exists to prevent.
 */
export function GasTankButton() {
  const { isConnected } = useAccount();
  const { chainId } = useContracts();
  const { openGasTankModal } = useGasTankModal();
  const { totalBalanceUsdc6 } = useGasTankAllChains();
  const { runsLeft, level, isEmpty, isLow } = useGasTankLevel(totalBalanceUsdc6, chainId);

  /** Flashes once whenever the balance grows — the tell that a top-up actually landed. */
  const [justFilled, setJustFilled] = useState(false);
  const previous = useRef(totalBalanceUsdc6);
  const flashTimer = useRef<number | null>(null);

  useEffect(() => {
    const grew = totalBalanceUsdc6 > previous.current;
    previous.current = totalBalanceUsdc6;
    if (!grew) return;

    queueMicrotask(() => setJustFilled(true));
    if (flashTimer.current != null) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setJustFilled(false), 1400);

    return () => {
      if (flashTimer.current != null) window.clearTimeout(flashTimer.current);
    };
  }, [totalBalanceUsdc6]);

  if (!isConnected || getChainsWithGasTank().length === 0) return null;

  const tone = isEmpty ? "empty" : isLow ? "low" : "ok";
  const runsLabel = runsLeft > 999 ? "999+" : String(runsLeft);

  return (
    <button
      type="button"
      onClick={openGasTankModal}
      title={`Gas tank: ${gasAmountFromUsdc6(totalBalanceUsdc6)} USDC — about ${runsLabel} scheduled runs. Click to top up.`}
      aria-label={`Gas tank: ${gasAmountFromUsdc6(totalBalanceUsdc6)} USDC, about ${runsLabel} runs remaining. Open to top up.`}
      className={`gt-pill gt-pill-${tone}${justFilled ? " is-filled" : ""}`}
    >
      <span className="gt-pill-icon" aria-hidden>
        <GasTankIcon />
      </span>

      <span className="gt-pill-copy">
        <span className="gt-pill-value">
          <AnimatedGasAmount valueUsdc6={totalBalanceUsdc6} />
          <small>USDC</small>
        </span>
        <span className="gt-pill-meter" aria-hidden>
          <span className="gt-pill-fill" style={{ ["--w" as string]: `${Math.max(2, level * 100)}%` }} />
        </span>
      </span>

      <span className="gt-pill-runs">{isEmpty ? "empty" : `~${runsLabel} runs`}</span>
      {justFilled && <span className="gt-pill-spark" aria-hidden />}
    </button>
  );
}
