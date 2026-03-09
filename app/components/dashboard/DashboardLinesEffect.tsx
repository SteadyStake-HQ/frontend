"use client";

/**
 * Falling gradient droplets along vertical lines - background effect for dashboard.
 * Adapted from bg_effect.txt: vertical lines with animated droplets using theme colors.
 */
export function DashboardLinesEffect() {
  return (
    <div className="dashboard-lines-effect" aria-hidden>
      <div className="dashboard-lines">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="dashboard-line" />
        ))}
      </div>
    </div>
  );
}
