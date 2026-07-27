"use client";

import { useMemo } from "react";
import { useChainId } from "wagmi";
import {
  getContracts,
  getStableSymbol,
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

/**
 * Display symbol of the stablecoin the vault actually settles in on the connected chain — "USDC"
 * on most networks, "USDT" on BOT Chain. Keyed off `contracts.chainId` rather than the connected
 * chain so the label always matches the addresses the UI is reading.
 */
export function useStableSymbol(): string {
  const { contracts } = useContracts();
  return getStableSymbol(contracts.chainId);
}
