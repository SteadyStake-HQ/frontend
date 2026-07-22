"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const SECTIONS = [
  { id: "home", label: "Home" },
  { id: "problem", label: "Problem" },
  { id: "networks", label: "Networks" },
  { id: "how-it-works", label: "How it works" },
  { id: "economics", label: "Economics" },
  { id: "roadmap", label: "Roadmap" },
] as const;

/**
 * Floating vertical section rail, pinned to the middle of the right edge.
 * Replaces the horizontal header nav, which could not share the top row with
 * the brand lockup and the wallet cluster without overflowing.
 *
 * Active section is resolved from raw viewport geometry on scroll rather than
 * from IntersectionObserver ratios: sections here vary wildly in height, so
 * "whichever section covers the viewport midline" is far more stable than
 * "whichever section is most visible".
 */
export function SectionRail() {
  const [active, setActive] = useState<string>(SECTIONS[0].id);
  const [revealed, setRevealed] = useState(false);
  const frame = useRef<number | null>(null);

  const sync = useCallback(() => {
    const midline = window.innerHeight / 2;
    let current: string = SECTIONS[0].id;

    for (const section of SECTIONS) {
      const el = document.getElementById(section.id);
      if (!el) continue;
      const { top, bottom } = el.getBoundingClientRect();
      if (top <= midline && bottom > midline) {
        current = section.id;
        break;
      }
      // Past the midline already — keep the last section we scrolled through.
      if (top <= midline) current = section.id;
    }

    setActive(current);
    // Hide the rail while the hero still owns most of the screen.
    setRevealed(window.scrollY > window.innerHeight * 0.35);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      if (frame.current !== null) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        sync();
      });
    };

    // Initial pass goes through the same rAF path, so a deep-linked or
    // restored scroll position lands on the right dot without a sync setState.
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [sync]);

  const activeIndex = Math.max(
    0,
    SECTIONS.findIndex((s) => s.id === active),
  );

  return (
    <nav
      className={`ss-rail${revealed ? " is-revealed" : ""}`}
      aria-label="Section navigation"
    >
      <span className="ss-rail-track" aria-hidden="true">
        <span
          className="ss-rail-progress"
          style={{
            transform: `translateY(${activeIndex * 100}%)`,
          }}
        />
      </span>
      <ul className="ss-rail-list">
        {SECTIONS.map((section) => {
          const isActive = section.id === active;
          return (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className={`ss-rail-item${isActive ? " is-active" : ""}`}
                aria-current={isActive ? "true" : undefined}
              >
                <span className="ss-rail-label">{section.label}</span>
                <span className="ss-rail-dot" aria-hidden="true">
                  <span className="ss-rail-pulse" />
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
