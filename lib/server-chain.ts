/**
 * Server-side chain/RPC resolution for route handlers. The wagmi config in config/wagmi.ts is
 * built for the browser (RainbowKit connectors), so server routes need their own viem clients.
 *
 * RPC URLs come from RPC_URL_<chainId> when set, falling back to a public endpoint per chain.
 */
import { createPublicClient, http, type Chain, type PublicClient } from "viem";
import { base, baseSepolia, bsc, polygon, sepolia } from "viem/chains";

const CHAIN_RPC: Record<number, string> = {
  8453: process.env.RPC_URL_8453 ?? "https://mainnet.base.org",
  84532: process.env.RPC_URL_84532 ?? "https://sepolia.base.org",
  // rpc.sepolia.org frequently times out (522); PublicNode is the reliable default.
  11155111: process.env.RPC_URL_11155111 ?? "https://ethereum-sepolia-rpc.publicnode.com",
  56: process.env.RPC_URL_56 ?? "https://bsc-dataseed.binance.org",
  137: process.env.RPC_URL_137 ?? "https://polygon-rpc.com",
  2222: process.env.RPC_URL_2222 ?? "https://evm.kava.io",
  // BOT Chain: eth_getLogs is disabled on the public mainnet endpoint.
  677: process.env.RPC_URL_677 ?? "https://rpc.botchain.ai",
  968: process.env.RPC_URL_968 ?? "https://rpc.bohr.life",
};

const kavaChain: Chain = {
  id: 2222,
  name: "Kava",
  nativeCurrency: { decimals: 18, name: "Kava", symbol: "KAVA" },
  rpcUrls: { default: { http: [CHAIN_RPC[2222]!] } },
};

const botChain: Chain = {
  id: 677,
  name: "BOT Chain",
  nativeCurrency: { decimals: 18, name: "BOT", symbol: "BOT" },
  rpcUrls: { default: { http: [CHAIN_RPC[677]!] } },
  blockExplorers: { default: { name: "BOTScan", url: "https://scan.botchain.ai" } },
  contracts: { multicall3: { address: "0x47FA21f684bBAD707A53a0f9BE59F1422F46C265" } },
};

const botTestnet: Chain = {
  id: 968,
  name: "BOT Chain Testnet",
  nativeCurrency: { decimals: 18, name: "BOT", symbol: "tBOT" },
  rpcUrls: { default: { http: [CHAIN_RPC[968]!] } },
  blockExplorers: { default: { name: "BOTScan", url: "https://scan.bohr.life" } },
  contracts: { multicall3: { address: "0x47FA21f684bBAD707A53a0f9BE59F1422F46C265" } },
  testnet: true,
};

export function getChain(chainId: number): Chain | undefined {
  if (chainId === 8453) return base;
  if (chainId === 84532) return baseSepolia;
  if (chainId === 11155111) return sepolia;
  if (chainId === 56) return bsc;
  if (chainId === 137) return polygon;
  if (chainId === 2222) return kavaChain;
  if (chainId === 677) return botChain;
  if (chainId === 968) return botTestnet;
  return undefined;
}

export function getRpcUrl(chainId: number): string | undefined {
  return CHAIN_RPC[chainId];
}

/** Public client for `chainId`, or null when the chain isn't configured. */
export function getServerPublicClient(chainId: number): PublicClient | null {
  const chain = getChain(chainId);
  const rpcUrl = getRpcUrl(chainId);
  if (!chain || !rpcUrl) return null;
  return createPublicClient({ chain, transport: http(rpcUrl) }) as PublicClient;
}
