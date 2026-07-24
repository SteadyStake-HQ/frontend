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

/**
 * BOT Chain mainnet (chain 677). EVM, Parlia consensus (BSC-derived), ~0.75s blocks.
 * Docs: https://dev-docs.botchain.ai/docs/Developers/json-rpc-endpoint/
 */
export const botChain = defineChain({
  id: 677,
  name: "BOT Chain",
  nativeCurrency: { decimals: 18, name: "BOT", symbol: "BOT" },
  rpcUrls: {
    default: { http: ["https://rpc.botchain.ai"] },
  },
  blockExplorers: {
    default: { name: "BOTScan", url: "https://scan.botchain.ai" },
  },
  contracts: {
    multicall3: { address: "0x47FA21f684bBAD707A53a0f9BE59F1422F46C265" },
  },
});

/** BOT Chain testnet (chain 968). Faucet: https://faucet.botchain.ai/basic */
export const botTestnet = defineChain({
  id: 968,
  name: "BOT Chain Testnet",
  nativeCurrency: { decimals: 18, name: "BOT", symbol: "tBOT" },
  rpcUrls: {
    default: { http: ["https://rpc.bohr.life"] },
  },
  blockExplorers: {
    default: { name: "BOTScan", url: "https://scan.bohr.life" },
  },
  contracts: {
    multicall3: { address: "0x47FA21f684bBAD707A53a0f9BE59F1422F46C265" },
  },
  testnet: true,
});

/**
 * BOT Chain brand tokens — SteadyStake's partner network, so this is the one
 * palette that is quoted verbatim rather than re-tinted per surface. `mark` is
 * the exact green of /bot.svg; `primary`/`secondary` lift it for dark UI, and
 * `bed` is the dark disc the green mark sits on in icon wells.
 */
export const BOT_BRAND = {
  mark: "#10A37F",
  primary: "#14C79A",
  secondary: "#5EEAD4",
  glow: "rgba(20, 199, 154, 0.32)",
  onBrand: "#022C22",
  bed: "#062A22",
} as const;

/** Chain icon URLs for header and network switcher modal – local assets so icons load reliably. */
export const CHAIN_ICON_URLS: Record<number, string> = {
  [botChain.id]: "/bot.svg",
  [botTestnet.id]: "/bot.svg",
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
  { primary: string; secondary: string; glow: string; onBrand?: string }
> = {
  // BOT Chain leads the list: it is the partner network, and its palette is the
  // brand green from /bot.svg rather than a per-surface re-tint (see BOT_BRAND).
  [botChain.id]: {
    primary: BOT_BRAND.primary,
    secondary: BOT_BRAND.secondary,
    glow: BOT_BRAND.glow,
    onBrand: BOT_BRAND.onBrand,
  },
  [botTestnet.id]: {
    primary: BOT_BRAND.primary,
    secondary: BOT_BRAND.secondary,
    glow: BOT_BRAND.glow,
    onBrand: BOT_BRAND.onBrand,
  },
  [base.id]: {
    primary: "#38BDF8",
    secondary: "#7DD3FC",
    glow: "rgba(56, 189, 248, 0.3)",
    onBrand: "#082F49",
  },
  [baseSepolia.id]: {
    primary: "#38BDF8",
    secondary: "#7DD3FC",
    glow: "rgba(56, 189, 248, 0.3)",
    onBrand: "#082F49",
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
    onBrand: "#2A2100",
  },
  [kava.id]: {
    primary: "#FF564F",
    secondary: "#E03D36",
    glow: "rgba(255, 86, 79, 0.28)",
  },
  [polygon.id]: {
    // Polygon's brand purple (#8247E5) is too dark to sit under the UI's light
    // text and glows, so we lift it to a softer violet — same 400/300 + dark-ink
    // shape as Base above, which keeps the two networks feeling like one system.
    primary: "#A78BFA",
    secondary: "#C4B5FD",
    glow: "rgba(167, 139, 250, 0.32)",
    onBrand: "#2E1065",
  },
};

/** Kava chain with icon for network switcher modal (local SVG fallback) */
const kavaWithIcon = {
  ...kava,
  iconUrl: "/kava.svg",
  iconBackground: "#FF564F",
} as const;

/**
 * Order matters: this array drives the order of the RainbowKit network switcher,
 * so BOT Chain — the partner network — sits at the top of the list.
 */
const ALL_CHAINS = [
  { ...botChain, iconUrl: CHAIN_ICON_URLS[botChain.id], iconBackground: BOT_BRAND.bed },
  { ...botTestnet, iconUrl: CHAIN_ICON_URLS[botTestnet.id], iconBackground: BOT_BRAND.bed },
  { ...base, iconUrl: CHAIN_ICON_URLS[base.id], iconBackground: "#0052FF" },
  { ...baseSepolia, iconUrl: CHAIN_ICON_URLS[baseSepolia.id], iconBackground: "#0052FF" },
  { ...sepolia, iconUrl: CHAIN_ICON_URLS[sepolia.id], iconBackground: "#627EEA" },
  { ...bsc, iconUrl: CHAIN_ICON_URLS[bsc.id], iconBackground: "#F0B90B" },
  kavaWithIcon,
  { ...polygon, iconUrl: CHAIN_ICON_URLS[polygon.id], iconBackground: "#8247E5" },
] as const;

/**
 * Ticker of the token network fees are actually paid in. The gas tank is denominated in USDC but
 * the relayer pays in this, so anything explaining the per-run price has to name it.
 * Falls back to "the native token" rather than guessing ETH for an unlisted chain.
 */
export function getNativeSymbol(chainId: number): string {
  return ALL_CHAINS.find((c) => c.id === chainId)?.nativeCurrency.symbol ?? "the native token";
}

/** Ethereum Sepolia: use PublicNode RPC; default rpc.sepolia.org often times out (522). */
const ETH_SEPOLIA_RPC = "https://ethereum-sepolia-rpc.publicnode.com";

const ALL_TRANSPORTS: Record<number, ReturnType<typeof http>> = {
  [base.id]: http(),
  [baseSepolia.id]: http(),
  [sepolia.id]: http(ETH_SEPOLIA_RPC),
  [bsc.id]: http(),
  [kava.id]: http(),
  [polygon.id]: http(),
  [botChain.id]: http(),
  [botTestnet.id]: http(),
};

type ChainEntry = (typeof ALL_CHAINS)[number];

/** Networks: filtered by NEXT_PUBLIC_SUPPORTED_CHAIN_IDS from .env. At least one chain is always present (defaults in chains-env). */
export const config = getDefaultConfig({
  appName: "SteadyStake",
  projectId: projectId || "YOUR_PROJECT_ID",
  // Defer persisted wallet-store hydration until after React mounts. Without
  // this, Wagmi's Hydrate component mutates its external store during render,
  // which React 19 reports as a cross-component update on DashboardPage.
  ssr: true,
  chains: ALL_CHAINS.filter((c) => SUPPORTED_CHAIN_IDS.includes(c.id)) as [ChainEntry, ...ChainEntry[]],
  transports: Object.fromEntries(
    SUPPORTED_CHAIN_IDS.filter((id) => id in ALL_TRANSPORTS).map((id) => [id, ALL_TRANSPORTS[id as keyof typeof ALL_TRANSPORTS]])
  ) as Record<number, ReturnType<typeof http>>,
});
