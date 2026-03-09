"use client";

import { useTheme } from "./ThemeProvider";

function SunIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {/* Center circle */}
      <circle cx="12" cy="12" r="3.5" />
      {/* Rays */}
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      <path d="M6.34 12H8M16 12h1.66M12 6.34V8M12 16v1.66" opacity="0.7" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {/* Crescent moon */}
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      {/* Small star */}
      <circle cx="17" cy="7" r="0.8" fill="currentColor" />
    </svg>
  );
}

export function ThemeSwitcher() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--hero-muted)]/20 bg-[var(--background)] text-[var(--foreground)] transition-all duration-300 hover:border-[var(--hero-primary)]/40 hover:bg-[var(--hero-primary)]/5 hover:text-[var(--hero-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--hero-primary)]/40 focus:ring-offset-2 focus:ring-offset-[var(--background)]"
      title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
      aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
    >
      <span className="relative h-5 w-5">
        <span
          className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${
            theme === "light"
              ? "rotate-0 scale-100 opacity-100"
              : "-rotate-90 scale-0 opacity-0"
          }`}
        >
          <SunIcon className="h-5 w-5 text-current" />
        </span>
        <span
          className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${
            theme === "dark"
              ? "rotate-0 scale-100 opacity-100"
              : "rotate-90 scale-0 opacity-0"
          }`}
        >
          <MoonIcon className="h-5 w-5 text-current" />
        </span>
      </span>
    </button>
  );
}
