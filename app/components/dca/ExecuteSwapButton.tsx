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
      <span className="plan-cooldown-chip" title="Next run is in cooldown">
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
        data-loading={isPending ? "true" : undefined}
        className="ss-btn ss-btn-success ss-btn-sm ss-btn-play min-w-[130px]"
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
