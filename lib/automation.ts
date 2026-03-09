/**
 * DCA automation: 0x quote + Gelato Relay for auto-executing schedules.
 * Used by the cron job that runs periodically.
 */

import { GelatoRelay, SponsoredCallRequest } from "@gelatonetwork/relay-sdk";
import { encodeFunctionData } from "viem";
import { DCA_VAULT_ABI } from "@/config/abis";
import deployedAddresses from "@/config/deployed-addresses.json";

/** USDC address per chain (6 decimals). */
const USDC_BY_CHAIN: Record<number, string> = {
  8453: "0x833589fCD6eDb6E08f4C7C32D4f71b54bdA02913",
  84532: "0x74C0cdB54B5bEB5fCf1073B8f1f6c583381c44D6",
  11155111: "0x89A01f63A5F4b42d30483ee17c5f537A4B94b15E", // ETH Sepolia (MockUSDC)
  56: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
  137: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
  2222: "0xfA9343C3897324496A05fC75abeD6bAC29f8A40f",
};

/** 0x API base. */
const ZERO_EX_BASE = "https://api.0x.org";

export interface ScheduleInfo {
  user: `0x${string}`;
  scheduleId: bigint;
  targetToken: `0x${string}`;
  amountPerInterval: bigint;
  totalAmount: bigint;
  feePercentage: number;
}

/**
 * Fetch 0x swap quote (sell USDC, buy targetToken). Returns transaction data for the 0x router.
 */
export async function get0xQuote(
  chainId: number,
  sellToken: string,
  buyToken: string,
  sellAmountWei: string,
  apiKey?: string,
  slippagePercent = 1
): Promise<{ data: string } | null> {
  const params = new URLSearchParams({
    chainId: String(chainId),
    sellToken,
    buyToken,
    sellAmount: sellAmountWei,
    slippagePercentage: String(slippagePercent),
  });
  const url = `${ZERO_EX_BASE}/swap/v1/quote?${params}`;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (apiKey) headers["0x-api-key"] = apiKey;

  const res = await fetch(url, { headers });
  if (!res.ok) return null;
  const json = (await res.json()) as { data?: string };
  return json.data ? { data: json.data } : null;
}

/**
 * Compute net USDC amount after vault fee (vault uses feePercentage in basis points, 10000 = 100%).
 */
export function netAmountAfterFee(amount: bigint, feeBps: number): bigint {
  const fee = (amount * BigInt(feeBps)) / BigInt(10000);
  return amount - fee;
}

/**
 * Build executeSwap calldata for DCAVault.
 */
export function buildExecuteSwapCalldata(
  user: `0x${string}`,
  scheduleId: bigint,
  swapData: string
): `0x${string}` {
  return encodeFunctionData({
    abi: DCA_VAULT_ABI,
    functionName: "executeSwap",
    args: [user, scheduleId, swapData as `0x${string}`],
  }) as `0x${string}`;
}

/**
 * Get DCAVault and USDC for a chain from deployed addresses.
 */
export function getVaultAndUsdc(chainId: number): { vault: string; usdc: string } | null {
  const byChain = deployedAddresses as Record<string, { DCAVault?: string; chainId?: number }>;
  const entry = byChain[String(chainId)];
  const usdc = USDC_BY_CHAIN[chainId];
  if (!entry?.DCAVault || !usdc) return null;
  return { vault: entry.DCAVault, usdc };
}

/**
 * Submit executeSwap to Gelato Relay (sponsored). Returns taskId or null on failure.
 */
export async function relayExecuteSwap(
  chainId: number,
  vaultAddress: string,
  calldata: `0x${string}`,
  apiKey: string,
  gasLimit?: number
): Promise<string | null> {
  const relay = new GelatoRelay();
  const request: SponsoredCallRequest = {
    chainId: BigInt(chainId),
    target: vaultAddress as `0x${string}`,
    data: calldata,
  };
  const options = gasLimit != null ? { gasLimit: BigInt(gasLimit) } : undefined;
  try {
    const response = await relay.sponsoredCall(request, apiKey, options);
    return response.taskId ?? null;
  } catch {
    return null;
  }
}
