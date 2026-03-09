"use client";

import Lottie from "lottie-react";
import { useEffect, useState } from "react";

export type LottieSectionName =
  | "hero"
  | "problem"
  | "whybase"
  | "howitworks"
  | "roadmap"
  | "whyfund"
  | "vision";

interface LottieSectionProps {
  name: LottieSectionName;
  className?: string;
  /** Max width/height in px; default 160 */
  size?: number;
}

export function LottieSection({
  name,
  className = "",
  size = 160,
}: LottieSectionProps) {
  const [data, setData] = useState<object | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/lottie/${name}.json`)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        // Silently fail - animation just won't render
      });
    return () => {
      cancelled = true;
    };
  }, [name]);

  if (!data) return null;

  return (
    <div
      className={className}
      style={{ width: size, height: size, margin: "0 auto" }}
      aria-hidden
    >
      <Lottie animationData={data} loop={true} autoplay={true} style={{ width: size, height: size }} />
    </div>
  );
}
