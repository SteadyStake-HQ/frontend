"use client";

import { useMemo } from "react";
import { useChainId } from "wagmi";
import {
  getContracts,
  CONTRACTS,
  DEFAULT_CHAIN_ID,
  isSupportedChain,
  type ChainContracts,
} from "@/config/contracts";

/**
 * Contracts and chainId for the currently connected chain.
 * When not connected or chain unsupported, falls back to default (Base mainnet).
 */
export function useContracts(): {
  chainId: number;
  contracts: ChainContracts;
  isSupported: boolean;
} {
  const chainId = useChainId();
  const resolvedChainId = chainId ?? DEFAULT_CHAIN_ID;
  // getContracts builds a fresh object per call, so without this every consumer's useCallback that
  // closes over `contracts` gets a new identity each render — enough to re-fire effects that depend
  // on those callbacks. The addresses only ever change with the chain.
  const contracts = useMemo(
    () => getContracts(resolvedChainId) ?? CONTRACTS,
    [resolvedChainId],
  );
  return {
    chainId: resolvedChainId,
    contracts,
    isSupported: chainId !== undefined && isSupportedChain(chainId),
  };
}
