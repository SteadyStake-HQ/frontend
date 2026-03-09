import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { base, baseSepolia, bsc, polygon, sepolia } from "wagmi/chains";
import { defineChain } from "viem";
import { SUPPORTED_CHAIN_IDS } from "./chains-env";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
if (!projectId && typeof window !== "undefined") {
  console.warn(
    "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set. Get one at https://cloud.walletconnect.com for WalletConnect (e.g. Rainbow mobile).",
  );
}

/** Kava EVM mainnet (chain 2222) */
export const kava = defineChain({
  id: 2222,
  name: "Kava",
  nativeCurrency: { decimals: 18, name: "Kava", symbol: "KAVA" },
  rpcUrls: {
    default: { http: ["https://evm.kava.io"] },
  },
  blockExplorers: {
    default: { name: "Kavascan", url: "https://kavascan.com" },
  },
});

/** Chain icon URLs for header and network switcher modal – local assets so icons load reliably. */
export const CHAIN_ICON_URLS: Record<number, string> = {
  [base.id]: "/base.svg",
  [baseSepolia.id]: "/base.svg",
  [sepolia.id]: "/eth.svg",
  [bsc.id]: "/bsc.svg",
  [kava.id]: "/kava.svg",
  [polygon.id]: "/polygon.svg",
};

/** Gradient/theme colors per network for background and accents (primary, secondary, glow). */
export const CHAIN_THEME: Record<
  number,
  { primary: string; secondary: string; glow: string }
> = {
  [base.id]: {
    primary: "#0052FF",
    secondary: "#3385FF",
    glow: "rgba(0, 82, 255, 0.28)",
  },
  [baseSepolia.id]: {
    primary: "#0052FF",
    secondary: "#3385FF",
    glow: "rgba(0, 82, 255, 0.28)",
  },
  [sepolia.id]: {
    primary: "#627EEA",
    secondary: "#8B9FEE",
    glow: "rgba(98, 126, 234, 0.28)",
  },
  [bsc.id]: {
    primary: "#F0B90B",
    secondary: "#F8D12F",
    glow: "rgba(240, 185, 11, 0.3)",
  },
  [kava.id]: {
    primary: "#FF564F",
    secondary: "#E03D36",
    glow: "rgba(255, 86, 79, 0.28)",
  },
  [polygon.id]: {
    primary: "#8247E5",
    secondary: "#9B6BED",
    glow: "rgba(130, 71, 229, 0.28)",
  },
};

/** Kava chain with icon for network switcher modal (local SVG fallback) */
const kavaWithIcon = {
  ...kava,
  iconUrl: "/kava.svg",
  iconBackground: "#FF564F",
} as const;

const ALL_CHAINS = [
  { ...base, iconUrl: CHAIN_ICON_URLS[base.id], iconBackground: "#0052FF" },
  { ...baseSepolia, iconUrl: CHAIN_ICON_URLS[baseSepolia.id], iconBackground: "#0052FF" },
  { ...sepolia, iconUrl: CHAIN_ICON_URLS[sepolia.id], iconBackground: "#627EEA" },
  { ...bsc, iconUrl: CHAIN_ICON_URLS[bsc.id], iconBackground: "#F0B90B" },
  kavaWithIcon,
  { ...polygon, iconUrl: CHAIN_ICON_URLS[polygon.id], iconBackground: "#8247E5" },
] as const;

/** Ethereum Sepolia: use PublicNode RPC; default rpc.sepolia.org often times out (522). */
const ETH_SEPOLIA_RPC = "https://ethereum-sepolia-rpc.publicnode.com";

const ALL_TRANSPORTS: Record<number, ReturnType<typeof http>> = {
  [base.id]: http(),
  [baseSepolia.id]: http(),
  [sepolia.id]: http(ETH_SEPOLIA_RPC),
  [bsc.id]: http(),
  [kava.id]: http(),
  [polygon.id]: http(),
};

type ChainEntry = (typeof ALL_CHAINS)[number];

/** Networks: filtered by NEXT_PUBLIC_SUPPORTED_CHAIN_IDS from .env. At least one chain is always present (defaults in chains-env). */
export const config = getDefaultConfig({
  appName: "SteadyStake",
  projectId: projectId || "YOUR_PROJECT_ID",
  chains: ALL_CHAINS.filter((c) => SUPPORTED_CHAIN_IDS.includes(c.id)) as [ChainEntry, ...ChainEntry[]],
  transports: Object.fromEntries(
    SUPPORTED_CHAIN_IDS.filter((id) => id in ALL_TRANSPORTS).map((id) => [id, ALL_TRANSPORTS[id as keyof typeof ALL_TRANSPORTS]])
  ) as Record<number, ReturnType<typeof http>>,
});
