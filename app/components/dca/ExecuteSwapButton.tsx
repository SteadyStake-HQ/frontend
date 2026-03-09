"use client";

import { useState } from "react";
import { useWriteContract, useAccount } from "wagmi";
import { useContracts } from "@/app/hooks";
import { DCA_VAULT_ABI } from "@/config/abis";

interface ExecuteSwapButtonProps {
  userAddress: string;
  scheduleId: bigint;
  isReady: boolean;
  onSuccess?: () => void;
  disabled?: boolean;
}

export function ExecuteSwapButton({
  userAddress,
  scheduleId,
  isReady,
  onSuccess,
  disabled,
}: ExecuteSwapButtonProps) {
  const { address } = useAccount();
  const { chainId, contracts } = useContracts();
  const { writeContract, isPending } = useWriteContract();
  const [error, setError] = useState<string | null>(null);

  const handleExecute = async () => {
    setError(null);
    
    try {
      await writeContract(
        {
          address: contracts.DCAVault as `0x${string}`,
          abi: DCA_VAULT_ABI,
          functionName: "executeSwap",
          args: [userAddress as `0x${string}`, scheduleId, "0x"],
          chainId,
        },
        {
          onSuccess: () => {
            setTimeout(() => {
              onSuccess?.();
            }, 2000);
          },
          onError: (err) => {
            setError(err.message);
          },
        }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to execute swap");
    }
  };

  if (!isReady) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full bg-[var(--hero-muted)]/15 px-2.5 py-1 text-xs font-medium text-[var(--hero-muted)]"
        title="Next run is in cooldown"
      >
        <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Not ready
      </span>
    );
  }

  return (
    <div>
      <button
        onClick={handleExecute}
        disabled={isPending || disabled}
        className="inline-flex min-w-[130px] items-center justify-center gap-2 rounded-lg bg-[color-mix(in_srgb,var(--hero-primary)_80%,var(--hero-secondary))] px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:shadow-lg hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? (
          <>
            <svg className="h-4 w-4 shrink-0 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity={0.25} />
              <path fill="currentColor" d="M12 2a10 10 0 0 1 10 10h-2a8 8 0 0 0-8-8V2z" />
            </svg>
            Executing...
          </>
        ) : (
          <>
            <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path d="M8 5v14l11-7L8 5z" />
            </svg>
            Execute Now
          </>
        )}
      </button>
      {error && (
        <p className="mt-2 text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
