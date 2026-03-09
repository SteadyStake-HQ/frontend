"use client";

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
  const contracts = getContracts(resolvedChainId) ?? CONTRACTS;
  return {
    chainId: resolvedChainId,
    contracts,
    isSupported: chainId !== undefined && isSupportedChain(chainId),
  };
}
