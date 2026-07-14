"use client";

import { useEffect, useRef, useCallback } from "react";

const TILT_MAX = 5;
const TILT_SMOOTH = 0.12;
const HOVER_SCALE = 1.015;

export function Card3D({
  children,
  className = "",
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const rotateRef = useRef({ x: 0, y: 0, s: 1 });
  const targetRef = useRef({ x: 0, y: 0, s: 1 });
  const rafRef = useRef<number | null>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    const inner = innerRef.current;
    if (!card || !inner) return;
    const rect = card.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;

    // Feeds the accent glow that tracks the pointer across the card face.
    inner.style.setProperty("--mx", `${px * 100}%`);
    inner.style.setProperty("--my", `${py * 100}%`);

    targetRef.current = {
      x: -(py - 0.5) * TILT_MAX,
      y: (px - 0.5) * TILT_MAX,
      s: HOVER_SCALE,
    };
  }, []);

  const handleMouseLeave = useCallback(() => {
    targetRef.current = { x: 0, y: 0, s: 1 };
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const animate = () => {
      const target = targetRef.current;
      let { x, y, s } = rotateRef.current;
      x += (target.x - x) * TILT_SMOOTH;
      y += (target.y - y) * TILT_SMOOTH;
      s += (target.s - s) * TILT_SMOOTH;

      const settled =
        target.s === 1 && Math.abs(x) < 0.02 && Math.abs(y) < 0.02 && Math.abs(s - 1) < 0.0005;
      if (settled) {
        x = 0;
        y = 0;
        s = 1;
      }

      rotateRef.current = { x, y, s };
      const inner = innerRef.current;
      if (inner) {
        inner.style.transform = `perspective(1400px) rotateX(${x.toFixed(3)}deg) rotateY(${y.toFixed(3)}deg) scale(${s.toFixed(4)})`;
      }
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div
      ref={cardRef}
      className={`landing-card-3d ${className}`}
      style={style}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div ref={innerRef} className="landing-card-3d-inner h-full">
        {children}
      </div>
    </div>
  );
}
