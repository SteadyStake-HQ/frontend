"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface RevealOnScrollProps {
  children: ReactNode;
  /** Optional delay in ms before animating (stagger children when used with RevealStagger) */
  delay?: number;
  /** Extra class for the wrapper when visible */
  className?: string;
  /** Root margin for Intersection Observer (e.g. "0px 0px -60px 0px" to trigger a bit early) */
  rootMargin?: string;
}

export function RevealOnScroll({
  children,
  delay = 0,
  className = "",
  rootMargin = "0px 0px -50px 0px",
}: RevealOnScrollProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [delayedVisible, setDelayedVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setVisible(true);
        });
      },
      { threshold: 0.1, rootMargin },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  useEffect(() => {
    if (!visible) return;
    if (delay === 0) {
      queueMicrotask(() => setDelayedVisible(true));
      return;
    }
    const t = setTimeout(() => setDelayedVisible(true), delay);
    return () => clearTimeout(t);
  }, [visible, delay]);

  return (
    <div
      ref={ref}
      suppressHydrationWarning
      className={`reveal-on-scroll ${delayedVisible ? "reveal-visible" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

/** Use on a parent; children with .reveal-stagger-item get staggered animation delays */
export function RevealStagger({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <RevealOnScroll className={`reveal-stagger ${className}`}>
      {children}
    </RevealOnScroll>
  );
}
