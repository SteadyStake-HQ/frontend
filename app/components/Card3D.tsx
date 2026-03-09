"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const TILT_MAX = 8;
const TILT_SMOOTH = 0.15;

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
  const rotateRef = useRef({ x: 0, y: 0 });
  const targetRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    const inner = innerRef.current;
    if (!card || !inner) return;
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    targetRef.current = { x: -y * TILT_MAX, y: x * TILT_MAX };
  }, []);

  const handleMouseLeave = useCallback(() => {
    targetRef.current = { x: 0, y: 0 };
  }, []);

  useEffect(() => {
    const animate = () => {
      const target = targetRef.current;
      let { x, y } = rotateRef.current;
      x += (target.x - x) * TILT_SMOOTH;
      y += (target.y - y) * TILT_SMOOTH;
      if (Math.abs(x) < 0.1 && Math.abs(y) < 0.1 && target.x === 0 && target.y === 0) {
        x = 0;
        y = 0;
      }
      rotateRef.current = { x, y };
      const inner = innerRef.current;
      if (inner) {
        const scale = target.x !== 0 || target.y !== 0 ? 1.02 : 1;
        inner.style.transform = `rotateX(${x}deg) rotateY(${y}deg) scale(${scale})`;
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
      <div ref={innerRef} className="landing-card-3d-inner h-full rounded-2xl">
        {children}
      </div>
    </div>
  );
}
