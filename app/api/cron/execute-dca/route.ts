import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, type Chain } from "viem";
import { base, baseSepolia, bsc, polygon, sepolia } from "viem/chains";
import { kv } from "@vercel/kv";
import {
  get0xQuote,
  netAmountAfterFee,
  buildExecuteSwapCalldata,
  getVaultAndUsdc,
  relayExecuteSwap,
} from "@/lib/automation";

const AUTOMATION_USERS_KEY = "dca:automation:users";

/** Chain IDs that are testnets (use GELATO_RELAY_API_KEY_TESTNET when set). */
const TESTNET_CHAIN_IDS = new Set([84532, 11155111]); // Base Sepolia, Ethereum Sepolia

function getAllowedChainIds(): Set<number> | null {
  const raw = process.env.AUTOMATION_CHAIN_IDS?.trim();
  if (!raw) return null;
  const ids = raw
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n) && n > 0);
  return ids.length > 0 ? new Set(ids) : null;
}

function getGelatoApiKey(chainId: number): string | undefined {
  const isTestnet = TESTNET_CHAIN_IDS.has(chainId);
  if (isTestnet && process.env.GELATO_RELAY_API_KEY_TESTNET) {
    return process.env.GELATO_RELAY_API_KEY_TESTNET;
  }
  return process.env.GELATO_RELAY_API_KEY;
}

const CHAIN_RPC: Record<number, string> = {
  8453: process.env.RPC_URL_8453 ?? "https://mainnet.base.org",
  84532: process.env.RPC_URL_84532 ?? "https://sepolia.base.org",
  11155111: process.env.RPC_URL_11155111 ?? "https://ethereum-sepolia-rpc.publicnode.com",
  56: process.env.RPC_URL_56 ?? "https://bsc-dataseed.binance.org",
  137: process.env.RPC_URL_137 ?? "https://polygon-rpc.com",
  2222: process.env.RPC_URL_2222 ?? "https://evm.kava.io",
};

const kavaChain: Chain = {
  id: 2222,
  name: "Kava",
  nativeCurrency: { decimals: 18, name: "Kava", symbol: "KAVA" },
  rpcUrls: { default: { http: [CHAIN_RPC[2222]!] } },
};

function getChain(chainId: number): Chain | undefined {
  if (chainId === 8453) return base;
  if (chainId === 84532) return baseSepolia;
  if (chainId === 11155111) return sepolia;
  if (chainId === 56) return bsc;
  if (chainId === 137) return polygon;
  if (chainId === 2222) return kavaChain;
  return undefined;
}

const DCA_VAULT_ABI = [
  {
    type: "function",
    name: "getActiveSchedules",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getSchedule",
    inputs: [
      { name: "user", type: "address" },
      { name: "scheduleId", type: "uint256" },
    ],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "targetToken", type: "address" },
          { name: "frequency", type: "uint8" },
          { name: "amountPerInterval", type: "uint256" },
          { name: "lastExecutionTime", type: "uint256" },
          { name: "totalAmount", type: "uint256" },
          { name: "executedCount", type: "uint256" },
          { name: "active", type: "bool" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isScheduleReady",
    inputs: [
      { name: "user", type: "address" },
      { name: "scheduleId", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  }, 
  {
    type: "function",
    name: "feePercentage",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

/**
 * GET /api/cron/execute-dca
 * Called by Vercel Cron. Reads registered users from KV, checks ready schedules, gets 0x quote, submits via Gelato Relay.
 * Secured by CRON_SECRET (Vercel sets this for cron invocations).
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const zeroExKey = process.env.ZERO_EX_API_KEY;
  const allowedChains = getAllowedChainIds();

  let members: string[] = [];
  try {
    members = (await kv.smembers(AUTOMATION_USERS_KEY)) as string[];
  } catch (e) {
    console.error("[execute-dca] KV smembers failed:", e);
    return NextResponse.json({ error: "KV unavailable" }, { status: 503 });
  }

  const executed: string[] = [];
  const errors: string[] = [];

  for (const member of members) {
    const [chainIdStr, userAddress] = member.split(":");
    const chainId = parseInt(chainIdStr, 10);
    if (!userAddress || isNaN(chainId)) continue;
    if (allowedChains && !allowedChains.has(chainId)) continue;

    const gelatoKey = getGelatoApiKey(chainId);
    if (!gelatoKey) {
      errors.push(
        `No Gelato API key for chain ${chainId} (set GELATO_RELAY_API_KEY or GELATO_RELAY_API_KEY_TESTNET for testnet)`,
      );
      continue;
    }

    const vaultInfo = getVaultAndUsdc(chainId);
    if (!vaultInfo) continue;

    const rpcUrl = CHAIN_RPC[chainId];
    if (!rpcUrl) continue;

    const chain = getChain(chainId);
    if (!chain) continue;
    const client = createPublicClient({
      chain,
      transport: http(rpcUrl),
    });

    const vault = vaultInfo.vault as `0x${string}`;
    const user = userAddress as `0x${string}`;

    let scheduleIds: bigint[] = [];
    try {
      scheduleIds = (await client.readContract({
        address: vault,
        abi: DCA_VAULT_ABI,
        functionName: "getActiveSchedules",
        args: [user],
      })) as bigint[];
    } catch (e) {
      errors.push(`getActiveSchedules ${member}: ${(e as Error).message}`);
      continue;
    }

    let feeBps = 25;
    try {
      feeBps = Number(
        await client.readContract({
          address: vault,
          abi: DCA_VAULT_ABI,
          functionName: "feePercentage",
        }),
      );
    } catch {
      // use default 0.25%
    }

    for (const scheduleId of scheduleIds) {
      let ready = false;
      let targetToken: `0x${string}` =
        "0x0000000000000000000000000000000000000000" as `0x${string}`;
      let amountPerInterval = BigInt(0);
      try {
        ready = await client.readContract({
          address: vault,
          abi: DCA_VAULT_ABI,
          functionName: "isScheduleReady",
          args: [user, scheduleId],
        });
        if (!ready) continue;
        const schedule = (await client.readContract({
          address: vault,
          abi: DCA_VAULT_ABI,
          functionName: "getSchedule",
          args: [user, scheduleId],
        })) as { targetToken: `0x${string}`; amountPerInterval: bigint };
        targetToken = schedule.targetToken;
        amountPerInterval = schedule.amountPerInterval;
      } catch (e) {
        errors.push(
          `isScheduleReady/getSchedule ${member} ${scheduleId}: ${(e as Error).message}`,
        );
        continue;
      }

      const netAmount = netAmountAfterFee(amountPerInterval, feeBps);
      const quote = await get0xQuote(
        chainId,
        vaultInfo.usdc,
        targetToken,
        netAmount.toString(),
        zeroExKey,
        1,
      );
      if (!quote?.data) {
        errors.push(`0x quote failed ${member} ${scheduleId}`);
        continue;
      }

      const calldata = buildExecuteSwapCalldata(user, scheduleId, quote.data);
      const taskId = await relayExecuteSwap(
        chainId,
        vaultInfo.vault,
        calldata,
        gelatoKey!,
        400_000,
      );
      if (taskId) {
        executed.push(`${member} scheduleId=${scheduleId} taskId=${taskId}`);
      } else {
        errors.push(`Gelato relay failed ${member} ${scheduleId}`);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    executed: executed.length,
    executedTasks: executed,
    errors: errors.length ? errors : undefined,
  });
}
