"use client";

export function LoadingSpinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  };

  return (
    <div className={`${sizeClasses[size]} animate-spin rounded-full border-2 border-[var(--hero-primary)]/20 border-t-[var(--hero-primary)]`} />
  );
}

export function LoadingCard({ message }: { message?: string }) {
  return (
    <div className="rounded-2xl border border-[var(--hero-muted)]/10 bg-[var(--background)] p-8 shadow-sm">
      <div className="flex flex-col items-center justify-center gap-4">
        <LoadingSpinner size="lg" />
        {message && (
          <p className="text-sm text-[var(--hero-muted)] animate-pulse">{message}</p>
        )}
      </div>
    </div>
  );
}

export function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-4 bg-[var(--hero-muted)]/20 rounded w-3/4" />
      <div className="h-4 bg-[var(--hero-muted)]/20 rounded w-1/2" />
    </div>
  );
}
